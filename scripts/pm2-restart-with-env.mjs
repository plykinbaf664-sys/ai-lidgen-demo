import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { isSafeAuthUsername, parsePasswordHash } from "../lib/auth/password-core.mjs";
import { argument, loadEnvFile } from "./auth-cli-utils.mjs";

const envFile = resolve(argument("--env-file", ".env.local"));
const processName = argument("--pm2-name", "leadgen-demo");
const launcherEnvironment = { ...process.env, NODE_ENV: "production" };

try {
  await loadEnvFile(envFile, true);
  if (!isSafeAuthUsername(process.env.AUTH_USERNAME)) throw new Error("AUTH_USERNAME: INVALID");
  if (!parsePasswordHash(process.env.AUTH_PASSWORD_HASH)) throw new Error("AUTH_PASSWORD_HASH: INVALID");
  if (!process.env.AUTH_SESSION_SECRET || process.env.AUTH_SESSION_SECRET.trim().length < 32) {
    throw new Error("AUTH_SESSION_SECRET: INVALID");
  }
  // Next.js must parse its escaped dotenv file itself. Passing raw `$`-delimited
  // hashes through PM2 causes Next's dotenv expansion to corrupt the value.
  for (const key of Object.keys(process.env)) {
    if (!(key in launcherEnvironment)) delete process.env[key];
  }
  for (const key of ["AUTH_USERNAME", "AUTH_PASSWORD_HASH", "AUTH_SESSION_SECRET"]) {
    delete launcherEnvironment[key];
  }
  try {
    execFileSync("pm2", ["delete", processName], { env: launcherEnvironment, stdio: "inherit" });
  } catch {
    // A missing process is equivalent to a clean restart.
  }
  execFileSync("pm2", ["start", "npm", "--name", processName, "--cwd", dirname(envFile), "--", "start"], {
    env: launcherEnvironment,
    stdio: "inherit",
  });
  execFileSync("pm2", ["save"], { env: launcherEnvironment, stdio: "inherit" });
  process.stdout.write(`PM2 process recreated; Next.js loads ${envFile} directly.\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "PM2 restart failed."}\n`);
  process.exitCode = 1;
}
