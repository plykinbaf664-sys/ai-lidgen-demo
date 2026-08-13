# Current Task

## Goal

Restore production ICP document import for arbitrary PDF, DOCX, and TXT files, report the real OpenAI failure category, and verify the complete document-to-preview pipeline on the VPS.

## Global Acceptance Criteria

- `/var/www/ai-lidgen-demo/.env.local` contains `OPENAI_API_KEY` without exposing it to the browser, logs, database, or command output.
- PM2 starts `leadgen-demo` from the production directory with the current `.env.local`.
- A direct server-side OpenAI request succeeds with an accessible configured model.
- The application and reverse proxy allow enough time for a full structured response from a real document.
- OpenAI authentication, project permission, model access, quota, rate-limit, timeout, bad-request, and upstream failures produce distinct safe public messages.
- Arbitrary ICP prose is normalized into product, avatars/segments, mandatory criteria, signals, personas, pains, offer, CTA, and exclusions using document evidence only.
- Missing source facts remain null or empty and are not invented.
- A real ICP DOCX produces structured intelligence and an editable preview.
- TypeScript, lint, build, security checks, and ICP regression checks pass.

### Stage 1 — OpenAI diagnosis and safe error taxonomy

#### Scope

- `lib/leadgen/icp-document-parser.ts`
- `app/api/leadgen/client-profile/import/route.ts` (request duration only)
- `scripts/check-icp-openai-errors.mjs`
- `.env.example` (`OPENAI_MODEL` example only)

#### Acceptance Criteria

- The fallback model is available to the production OpenAI project.
- Provider errors are classified using HTTP status plus safe error code/type, never the API key or raw credentials.
- `401` is not conflated with `403 model_not_found`, quota, or rate limiting.

### Stage 2 — Arbitrary ICP and no-hallucination regression

#### Scope

- `scripts/check-icp-openai-errors.mjs`
- existing extractor and adaptive ICP checks (read-only unless a bounded repair is required)

#### Acceptance Criteria

- The request explicitly accepts arbitrary business prose without template headings.
- Product, avatars/segments, mandatory criteria, signals, personas, pains, offer, CTA, and exclusions are represented in structured output.
- Unsupported output with no matching source excerpt is dropped rather than invented.

### Stage 3 — Production deployment and end-to-end verification

#### Scope

- `/var/www/ai-lidgen-demo/.env.local` (`OPENAI_MODEL` only; preserve all secrets)
- production build and PM2 process `leadgen-demo`
- no tracked production source edits outside the Stage 1–2 scope

#### Acceptance Criteria

- `OPENAI_MODEL=gpt-4.1` is active on the VPS.
- Direct OpenAI Responses API request succeeds.
- Real DOCX import reaches extraction, OpenAI, adaptive parsing, structured ICP, and preview.
- PM2 is online after restart and production smoke checks pass.

## What Must Not Change

- No dependency or `package.json` changes.
- No API keys or credentials in source, browser bundles, logs, database, test snapshots, or reports.
- No architecture-wide refactor.
- No automatic outreach or email sending.
- No destructive database or filesystem operations.
- No modification of unrelated user files.
