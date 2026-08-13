import { access, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { argument, readHidden } from "./auth-cli-utils.mjs";

const baseUrl = argument("--base-url", "http://127.0.0.1:3000").replace(/\/$/, "");
const username = argument("--username", "").trim();
const fixtureArg = argument("--fixture", "");
const fixtureCandidates = [
  fixtureArg,
  resolve("fixtures", "B24U_ЦА_для_холодного_email_трафика.docx"),
  resolve(process.env.USERPROFILE || "", "Downloads", "B24U_ЦА_для_холодного_email_трафика.docx"),
].filter(Boolean);

let fixture = "";
for (const candidate of fixtureCandidates) {
  try { await access(candidate); fixture = candidate; break; } catch { /* try next safe fixture location */ }
}
if (!username || !fixture) {
  console.error("Укажите --username и --fixture (если fixture отсутствует в fixtures/ или Downloads/).");
  process.exit(1);
}

const password = await readHidden("Пароль (скрытый ввод): ");
const origin = new URL(baseUrl).origin;
const login = await fetch(`${baseUrl}/api/auth/login`, {
  method: "POST",
  redirect: "manual",
  headers: { "Content-Type": "application/json", Origin: origin, "Sec-Fetch-Site": "same-origin" },
  body: JSON.stringify({ username, password }),
});
if (login.status !== 200) {
  console.error(`LOGIN: FAIL (HTTP ${login.status})`);
  process.exit(1);
}
const cookie = (login.headers.getSetCookie?.() ?? [login.headers.get("set-cookie")])
  .find((value) => value?.includes("leadgen_client_session="))?.split(";", 1)[0];
if (!cookie) {
  console.error("LOGIN COOKIE: FAIL");
  process.exit(1);
}

const bytes = await readFile(fixture);
const form = new FormData();
form.append("file", new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), basename(fixture));
const response = await fetch(`${baseUrl}/api/leadgen/client-profile/import`, {
  method: "POST",
  headers: { Cookie: cookie, Origin: origin, "Sec-Fetch-Site": "same-origin" },
  body: form,
});
const data = await response.json().catch(() => ({}));
if (!response.ok || !data?.success || !data?.preview?.intelligence) {
  console.error(`IMPORT: FAIL (HTTP ${response.status})`);
  process.exit(1);
}

const intelligence = data.preview.intelligence;
const text = (value) => JSON.stringify(value ?? "").toLowerCase();
const mandatory = text([intelligence.mandatoryCriteria, intelligence.qualificationRules]);
const checks = {
  PRODUCT: /b24u|ai-консультант|ии-консультант/.test(text(intelligence.product)),
  GOAL_CTA: /встреч|демонстр|demo/.test(text([intelligence.outreachGoal, intelligence.cta])),
  WEBSITE_TRAFFIC: /сайт/.test(mandatory) && /трафик|посещ/.test(mandatory),
  MULTI_AVATAR: Array.isArray(intelligence.avatars) && intelligence.avatars.length >= 4,
  PRIORITIES: intelligence.avatars?.filter((avatar) => avatar.priority).length >= 3,
  SIGNALS: intelligence.signals?.length >= 3,
  EXCLUSIONS: /исключ|не подходит|без сайта|нет сайта|нулев/.test(text([intelligence.exclusionCriteria, intelligence.qualificationRules])),
  PERSONA_LOGIC: intelligence.personaRules?.length >= 2,
  SCORING: intelligence.scoringRules?.length >= 1,
  PERSONALIZATION: (intelligence.personalizationRules?.value?.length ?? 0) >= 1,
  RESTRICTIONS: (intelligence.restrictions?.value?.length ?? 0) >= 1,
  EVIDENCE: [...(intelligence.avatars ?? []), ...(intelligence.signals ?? []), ...(intelligence.personaRules ?? []), ...(intelligence.qualificationRules ?? []), ...(intelligence.scoringRules ?? [])]
    .every((item) => typeof item.confidence === "number" && Boolean(item.sourceExcerpt)),
  QUALITY_GATE: data.preview.quality?.passed === true,
};

for (const [name, passed] of Object.entries(checks)) console.log(`${name}: ${passed ? "PASS" : "FAIL"}`);
const passed = Object.values(checks).every(Boolean);
console.log(`ADAPTIVE ICP FIXTURE: ${passed ? "PASS" : "FAIL"}`);
process.exit(passed ? 0 : 1);
