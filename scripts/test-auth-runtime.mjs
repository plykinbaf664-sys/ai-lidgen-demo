import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPasswordHash, parsePasswordHash, verifyClientCredentials } from "../lib/auth/password-core.mjs";
import { getRateLimitClientAddress } from "../lib/security/rate-limit-ip.mjs";
import { loadEnvFile, updateEnvValue } from "./auth-cli-utils.mjs";

const previous = {
  username: process.env.AUTH_USERNAME,
  passwordHash: process.env.AUTH_PASSWORD_HASH,
};

try {
  process.env.AUTH_USERNAME = "client@example.com";
  process.env.AUTH_PASSWORD_HASH = createPasswordHash("correct horse battery staple");
  assert.ok(parsePasswordHash(process.env.AUTH_PASSWORD_HASH));
  assert.equal(verifyClientCredentials("client@example.com", "correct horse battery staple"), true);
  assert.equal(verifyClientCredentials("client@example.com", "wrong password"), false);
  assert.equal(verifyClientCredentials("mailto:client@example.com", "correct horse battery staple"), false);

  const nginxRequest = new Request("http://127.0.0.1", {
    headers: { "x-real-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.3, 203.0.113.9" },
  });
  assert.equal(getRateLimitClientAddress(nginxRequest), "203.0.113.9");
  const forwardedRequest = new Request("http://127.0.0.1", {
    headers: { "x-forwarded-for": "198.51.100.3, 203.0.113.10" },
  });
  assert.equal(getRateLimitClientAddress(forwardedRequest), "203.0.113.10");
  assert.equal(getRateLimitClientAddress(new Request("http://127.0.0.1", { headers: { "x-real-ip": "invalid" } })), "local");

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "leadgen-auth-test-"));
  const temporaryEnv = join(temporaryDirectory, ".env.local");
  const generatedHash = createPasswordHash("dotenv expansion regression test");
  try {
    await writeFile(temporaryEnv, "AUTH_USERNAME=client@example.com\n", { mode: 0o600 });
    await updateEnvValue(temporaryEnv, "AUTH_PASSWORD_HASH", generatedHash);
    const persisted = await readFile(temporaryEnv, "utf8");
    assert.match(persisted, /^AUTH_PASSWORD_HASH=scrypt\\\$/m);
    delete process.env.AUTH_PASSWORD_HASH;
    await loadEnvFile(temporaryEnv, true);
    assert.equal(process.env.AUTH_PASSWORD_HASH, generatedHash);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
  process.stdout.write("AUTH RUNTIME TEST: PASS\n");
} finally {
  if (previous.username === undefined) delete process.env.AUTH_USERNAME; else process.env.AUTH_USERNAME = previous.username;
  if (previous.passwordHash === undefined) delete process.env.AUTH_PASSWORD_HASH; else process.env.AUTH_PASSWORD_HASH = previous.passwordHash;
}
