import { resolve } from "node:path";
import { isSafeAuthUsername, parsePasswordHash, verifyClientCredentials } from "../lib/auth/password-core.mjs";
import { argument, loadEnvFile, readHidden } from "./auth-cli-utils.mjs";

const envFile = resolve(argument("--env-file", ".env.local"));

try {
  await loadEnvFile(envFile);
  if (!isSafeAuthUsername(process.env.AUTH_USERNAME)) throw new Error("AUTH_USERNAME: INVALID");
  if (!parsePasswordHash(process.env.AUTH_PASSWORD_HASH)) throw new Error("AUTH_PASSWORD_HASH: INVALID");
  if (!process.env.AUTH_SESSION_SECRET || process.env.AUTH_SESSION_SECRET.trim().length < 32) throw new Error("AUTH_SESSION_SECRET: INVALID");
  const password = await readHidden("Пароль для проверки: ");
  if (!verifyClientCredentials(process.env.AUTH_USERNAME, password)) throw new Error("AUTH TEST: FAIL");
  process.stdout.write(`AUTH TEST: PASS (${process.env.AUTH_USERNAME})\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "AUTH TEST: FAIL"}\n`);
  process.exitCode = 1;
}
