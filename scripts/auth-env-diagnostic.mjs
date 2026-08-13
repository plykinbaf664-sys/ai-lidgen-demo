import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { isSafeAuthUsername, parsePasswordHash } from "../lib/auth/password-core.mjs";
import { argument } from "./auth-cli-utils.mjs";

const projectDirectory = resolve(argument("--project-dir", process.cwd()));
const processName = argument("--pm2-name", "leadgen-demo");
const envNames = [".env.production.local", ".env.local", ".env.production", ".env"];

function parseEnvFile(file) {
  const values = {};
  if (!existsSync(file)) return values;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = raw.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[match[1]] = value.replace(/\\\$/g, "$").replace(/\\n/g, "\n");
  }
  return values;
}

function usernameSummary(value) {
  if (value === undefined) return { present: false };
  const valid = isSafeAuthUsername(value);
  return {
    present: true,
    length: value.length,
    valid,
    value: valid ? value : undefined,
    hasMailto: /^mailto:/i.test(value),
    hasQuotes: /["'`]/.test(value),
    hasMarkdown: /[\[\]()<>]/.test(value),
    hasOuterWhitespace: value !== value.trim(),
  };
}

function hashSummary(value) {
  if (value === undefined) return { present: false };
  const parsed = parsePasswordHash(value);
  const parts = value.split("$");
  return {
    present: true,
    length: value.length,
    valid: Boolean(parsed),
    parts: parts.length,
    algorithm: parts[0] || null,
    saltLength: parts[1]?.length || 0,
    hashBytes: parsed?.hash.length || 0,
  };
}

function secretSummary(value) {
  return value === undefined
    ? { present: false }
    : { present: true, length: value.length, valid: value === value.trim() && value.length >= 32 };
}

const envFiles = Object.fromEntries(envNames.map((name) => [name, parseEnvFile(resolve(projectDirectory, name))]));
for (const name of envNames) {
  const file = resolve(projectDirectory, name);
  if (!existsSync(file)) continue;
  const stats = statSync(file);
  console.log("ENV_FILE", name, {
    mode: (stats.mode & 0o777).toString(8),
    uid: stats.uid,
    gid: stats.gid,
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
  });
}

const processes = JSON.parse(execFileSync("pm2", ["jlist"], { encoding: "utf8", maxBuffer: 10 * 1_024 * 1_024 }));
const target = processes.find((item) => item.name === processName);
if (!target) throw new Error(`PM2 process not found: ${processName}`);
const pm2Environment = target.pm2_env || {};
console.log("PM2", {
  pid: target.pid,
  status: pm2Environment.status,
  cwd: pm2Environment.pm_cwd,
  script: pm2Environment.pm_exec_path,
  execMode: pm2Environment.exec_mode,
  nodeVersion: pm2Environment.node_version,
  restarts: pm2Environment.restart_time,
  instances: pm2Environment.instances,
});

const dotenvValue = (key) => envNames.map((name) => envFiles[name][key]).find((value) => value !== undefined);
for (const key of ["AUTH_USERNAME", "AUTH_PASSWORD_HASH", "AUTH_SESSION_SECRET"]) {
  const fileValue = dotenvValue(key);
  const pm2Value = pm2Environment[key];
  const effectiveValue = pm2Value ?? fileValue;
  const summarize = key === "AUTH_USERNAME" ? usernameSummary : key === "AUTH_PASSWORD_HASH" ? hashSummary : secretSummary;
  console.log(key, {
    dotenv: summarize(fileValue),
    pm2: summarize(pm2Value),
    effective: summarize(effectiveValue),
    pm2OverridesDotenv: pm2Value !== undefined,
    same: fileValue !== undefined && pm2Value !== undefined ? fileValue === pm2Value : null,
  });
}

console.log("NODE_ENV", { dotenv: dotenvValue("NODE_ENV"), pm2: pm2Environment.NODE_ENV });
console.log("BASE_URL", { dotenv: dotenvValue("LEADGEN_BASE_URL"), pm2: pm2Environment.LEADGEN_BASE_URL });
