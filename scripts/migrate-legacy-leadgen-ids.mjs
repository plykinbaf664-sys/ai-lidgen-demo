import { createHash } from "node:crypto";
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { gzip, gunzip } from "node:zlib";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const root = path.resolve(process.env.LEADGEN_LOCAL_DATA_DIR || ".client-leadgen-data");
const tablesRoot = path.join(root, "tables");
const dryRun = process.argv.includes("--dry-run");

function asciiId(value) {
  if (/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value)) return value;
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "record";
  return `${slug}-${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

function replaceReferences(value, ids) {
  if (typeof value === "string") return ids.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => replaceReferences(item, ids));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceReferences(item, ids)]));
  }
  return value;
}

const files = (await readdir(tablesRoot)).filter((name) => name.endsWith(".json.gz"));
const tables = await Promise.all(files.map(async (name) => {
  const file = path.join(tablesRoot, name);
  return [file, JSON.parse((await gunzipAsync(await readFile(file))).toString("utf8"))];
}));
const ids = new Map();
for (const [, rows] of tables) for (const row of rows) if (typeof row?.id === "string") ids.set(row.id, asciiId(row.id));
const changed = [...ids].filter(([before, after]) => before !== after).length;
if (!dryRun) for (const [file, rows] of tables) {
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, await gzipAsync(JSON.stringify(replaceReferences(rows, ids))), { mode: 0o600 });
  await rename(file, `${file}.legacy-id-backup`);
  await rename(temporary, file);
}
console.log(JSON.stringify({ root, files: files.length, changed, dry_run: dryRun }));
