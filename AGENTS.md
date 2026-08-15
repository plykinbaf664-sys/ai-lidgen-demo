## Правила для Codex

Перед изменениями:

1. понять существующий flow;
2. найти root cause;
3. менять минимально необходимое;
4. не переписывать рабочую архитектуру без причины;
5. не ломать соседние pipeline stages.

Особенно не ломать без необходимости:

- auth;
- ICP;
- research;
- SMTP;
- IMAP;
- queue;
- follow-up;
- local storage.

Экономить токены:

- targeted repository search;
- читать только связанные файлы;
- не перечитывать весь repo;
- не создавать лишнюю документацию;
- не делать refactor ради refactor;
- deterministic logic решать кодом;
- LLM использовать только там, где нужна семантика.

---

## Проверка после изменений

Минимум:

npx tsc --noEmit
npm run lint
npm run build

Плюс релевантные regression/security tests.

Не отправлять реальные письма без явного разрешения.

Не делать destructive production operations без необходимости.

---

## Definition of Done

Рабочий Demo flow:

ICP
→ Segment
→ Research
→ Qualified Company
→ Signal
→ LPR
→ Email
→ Personalized Outreach
→ Approval
→ Queue
→ Send
→ Reply / Follow-up

Главная задача проекта:

**показать клиенту, как из его ICP система автономно получает небольшое количество качественных B2B-лидов и доводит их до персонализированного контакта.**