# Security audit — client MVP

Дата проверки: 2026-08-11. Область: single-client Next.js/VPS runtime, local persistent storage, crawler, SMTP/IMAP queue и импорт ICP. Это сокращение attack surface, а не заявление об абсолютной неуязвимости.

## Threat model

Активы: SMTP/IMAP credentials, OpenAI/search keys, пароль и session secret, ICP и его snapshots, компании/контакты/письма/history/Message-ID, persistent DB files, backups и server filesystem.

Основные угрозы: unauthenticated access, session/password theft, brute force/API abuse, ID manipulation, XSS/CSRF/SSRF, path traversal, malicious or oversized documents, prompt injection, secret/error/log leakage, public DB/backup exposure, dependency compromise и command/SQL injection.

Trust boundaries:

- Browser и весь ICP/search/scraped/LLM/email content считаются untrusted.
- Nginx — единственная публичная точка входа; Node слушает только `127.0.0.1`.
- SMTP/IMAP/OpenAI/search credentials существуют только в server environment.
- Upload обрабатывается в памяти; исходный файл не сохраняется и не исполняется.

## Security gate

| Категория | Статус | Контроль |
|---|---|---|
| AUTH | FIXED | Proxy + независимая signed-session проверка во всех private API; processor имеет отдельный secret. |
| SESSIONS | FIXED | HttpOnly, Secure в production, SameSite=Lax, TTL, random `jti`, HMAC verification, новый token после login, logout. |
| API ACCESS | FIXED | Endpoint-level guard, bounded IDs/query/body, single-client entity existence checks. |
| INPUT VALIDATION | FIXED | Длины, enums/IDs, email/profile fields, content length, upload metadata/signatures. |
| SQL | NOT APPLICABLE | Runtime использует local JSON adapter; пользовательский ввод не формирует SQL. |
| XSS | PASS | React escaping, отсутствует `dangerouslySetInnerHTML`, script CSP использует request nonce. |
| CSRF | FIXED | SameSite cookie + обязательная exact-Origin проверка для POST/PUT/PATCH/DELETE. |
| SSRF | FIXED | Только HTTP(S): DNS/IP allow-to-public check, private/reserved ranges blocked, DNS-pinned connection, redirect revalidation, ports 80/443, timeout и response limit. |
| UPLOADS | FIXED | PDF/DOCX/TXT, 2 MB default, MIME+extension+magic, bounded ZIP extraction, no macros/scripts/commands, no persistent original. |
| FILESYSTEM | FIXED | Storage outside web root; validated table names; Node bound to loopback; systemd filesystem restrictions and `UMask=0077`. |
| SECRETS | PASS | Server env only; no secret API responses or `NEXT_PUBLIC_*` secret; redaction covers logs/errors. |
| HEADERS | FIXED | CSP, nosniff, no-referrer, permissions policy, DENY/frame-ancestors, COOP/CORP, HSTS. |
| RATE LIMIT | FIXED | Login, upload, search, generation, mail/queue and IMAP limits; Node is reachable only through trusted Nginx. |
| ERROR LEAKAGE | FIXED | Public routes return allowlisted `PublicError` or generic errors, never raw stack/path/SQL/env details. |
| BACKUPS | FIXED | Outside web root, no `.env`, `0700` directory/`0600` archives, 14-day technical retention. |
| DEPENDENCIES | FIXED | Next.js and eslint config updated to 16.3.0; `npm audit` and `npm audit --omit=dev` report 0 findings. |

`DEPLOYMENT_READY = YES`, только после заполнения production secrets, установки file permissions и успешного HTTPS/Certbot шага из deployment-инструкции. При работе по HTTP статус автоматически считается `NO`.

## Regression coverage

`scripts/security-regression-check.mjs` отказывается работать не на loopback и без явного test flag. Проверены: unauthenticated page/API, session flags, invalid login/brute force, CSRF, manipulated/SQL-like IDs, XSS strings, PDF/DOCX/TXT, fake/corrupt/oversized/traversal uploads, duplicate filenames, prompt injection, no auto-save, DB/backup URL exposure, raw errors, direct/metadata/protocol/redirect SSRF и отсутствие tool permissions у AI parser.

## Remaining risks

- Rate limits хранятся в памяти одного Node-процесса и сбрасываются после restart. Для single-VPS/single-process это приемлемо; при горизонтальном масштабировании нужен shared limiter.
- Stateless session нельзя отозвать на сервере до TTL при уже украденной cookie; logout удаляет browser cookie, а ротация `AUTH_SESSION_SECRET` отзывает все sessions.
- Встроенный PDF extractor намеренно минимален: scanned/encrypted и некоторые font-encoded PDF будут отклонены или потребуют TXT/DOCX. Он не исполняет PDF actions.
- Антивирус не добавлен: файлы не сохраняются/не запускаются, а parsers и размеры ограничены. Для multi-user upload perimeter потребуется отдельный malware scanner.
- При настроенном OpenAI извлечённый текст уходит внешнему API. Запрос использует `store: false`, но стандартные abuse-monitoring logs могут храниться до 30 дней; для чувствительных документов следует оценить Zero Data Retention. См. [официальную документацию OpenAI о data controls](https://developers.openai.com/api/docs/guides/your-data#default-usage-policies-by-endpoint).
- `style-src 'unsafe-inline'` оставлен для существующих React inline styles; scripts защищены nonce и `strict-dynamic`. Удаление inline styles позволит дополнительно ужесточить style policy.
