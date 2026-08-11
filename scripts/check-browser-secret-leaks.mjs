import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

async function files(root) {
  if (!existsSync(root)) return [];
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...await files(target));
    else output.push(target);
  }
  return output;
}

const secrets = new Map();
for (const envFile of [".env.local", ".env.production"]) {
  if (!existsSync(envFile)) continue;
  const content = await readFile(envFile, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || !/(?:KEY|SECRET|PASSWORD|TOKEN|HASH)$/i.test(match[1])) continue;
    const value = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    if (value.length >= 8) secrets.set(match[1], value);
  }
}

const clientFiles = await files(path.join(".next", "static"));
const leaked = new Set();
for (const file of clientFiles) {
  const content = await readFile(file);
  for (const [name, value] of secrets) {
    if (content.includes(Buffer.from(value))) leaked.add(name);
  }
}

if (leaked.size) {
  process.stderr.write(`Secrets detected in browser bundle: ${[...leaked].join(", ")}\n`);
  process.exit(1);
}
process.stdout.write(`PASS: ${secrets.size} configured secret values are absent from ${clientFiles.length} browser files.\n`);
