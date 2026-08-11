import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [
  localDatabase,
  storageClient,
  syncRoute,
  profile,
  runRoute,
  proxy,
  mailboxIsolation,
  processor,
  followups,
  compaction,
  env,
  service,
  workerTimer,
  nginx,
  backup,
] = await Promise.all([
  read("lib/leadgen/local-database.ts"),
  read("lib/supabase/client.ts"),
  read("app/api/leadgen/storage/sync/route.ts"),
  read("lib/leadgen/client-profile.ts"),
  read("app/api/leadgen/run/route.ts"),
  read("proxy.ts"),
  read("lib/leadgen/mailbox-isolation.ts"),
  read("lib/leadgen/local-outreach-processor.ts"),
  read("lib/leadgen/followup-storage.ts"),
  read("lib/leadgen/local-storage-compaction.ts"),
  read(".env.example"),
  read("deploy/leadgen-client.service"),
  read("deploy/leadgen-worker.timer"),
  read("deploy/nginx-leadgen-client.conf"),
  read("scripts/backup-client-data.sh"),
]);

assert.match(localDatabase, /\.client-leadgen-data/);
assert.doesNotMatch(localDatabase, /path\.join\(process\.cwd\(\), "\.leadgen-data"\)/);
assert.match(storageClient, /createStorageAdapter/);
assert.doesNotMatch(syncRoute, /runSupabaseBackupSync|SUPABASE/);
assert.match(syncRoute, /status: 410/);
assert.match(profile, /createClientProfileSnapshot/);
assert.match(profile, /Сначала сохраните ICP клиента/);
assert.match(runRoute, /clientProfileSnapshot/);
assert.match(runRoute, /\[5, 10, 20\]/);
assert.match(proxy, /verifySessionToken/);
assert.match(proxy, /Unauthorized/);
assert.match(mailboxIsolation, /LEADGEN_CLIENT_INSTANCE_ID/);
assert.match(mailboxIsolation, /LEADGEN_CLIENT_MAILBOX/);
assert.match(processor, /provider\.validateConnection\(\)/);
assert.match(processor, /provider\.sendEmail\(entry\)/);
assert.match(followups, /reply_check_status/);
assert.match(followups, /reply_detected_at/);
assert.match(compaction, /leadgen_diagnostics/);
assert.match(compaction, /30 \* 24 \* 60 \* 60/);
for (const key of [
  "AUTH_USERNAME", "AUTH_PASSWORD_HASH", "AUTH_SESSION_SECRET",
  "SMTP_HOST", "SMTP_PASSWORD", "IMAP_HOST", "IMAP_PASSWORD",
  "LEADGEN_LOCAL_DATA_DIR", "OUTREACH_PROCESSOR_SECRET",
]) assert.match(env, new RegExp(`^${key}=`, "m"));
assert.match(service, /Restart=always/);
assert.match(service, /ReadWritePaths=\/var\/lib\/leadgen-client/);
assert.match(workerTimer, /Persistent=true/);
assert.match(nginx, /X-Forwarded-Proto/);
assert.match(backup, /leadgen-client-.*\.tar\.gz/);
assert.doesNotMatch(backup, /node_modules|\.next|cache|logs/);

console.log("CLIENT_MVP_SMOKE_OK (no SMTP send, no external mutation)");
