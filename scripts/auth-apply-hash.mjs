import { resolve } from "node:path";
import { isSafeAuthUsername, parsePasswordHash } from "../lib/auth/password-core.mjs";
import { argument, loadEnvFile, updateEnvValue } from "./auth-cli-utils.mjs";

const sourceFile = resolve(argument("--source-env", ".ai/auth-reset.env"));
const targetFile = resolve(argument("--target-env", ".env.local"));

try {
  await loadEnvFile(sourceFile, true);
  const sourceUsername = process.env.AUTH_USERNAME;
  const sourceHash = process.env.AUTH_PASSWORD_HASH;
  if (!isSafeAuthUsername(sourceUsername)) throw new Error("Source AUTH_USERNAME: INVALID");
  if (!parsePasswordHash(sourceHash)) throw new Error("Source AUTH_PASSWORD_HASH: INVALID");

  await loadEnvFile(targetFile, true);
  if (!isSafeAuthUsername(process.env.AUTH_USERNAME)) throw new Error("Target AUTH_USERNAME: INVALID");
  if (process.env.AUTH_USERNAME !== sourceUsername) throw new Error("Source and target AUTH_USERNAME do not match.");

  await updateEnvValue(targetFile, "AUTH_PASSWORD_HASH", sourceHash);
  process.stdout.write(`AUTH_PASSWORD_HASH safely applied to ${targetFile}.\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Unable to apply AUTH_PASSWORD_HASH."}\n`);
  process.exitCode = 1;
}
