import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";

export function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

export async function loadEnvFile(file, override = true) {
  const text = await readFile(file, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const match = raw.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || (!override && process.env[match[1]] !== undefined)) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value.replace(/\\\$/g, "$").replace(/\\n/g, "\n");
  }
  return text;
}

export async function updateEnvValue(file, key, value) {
  const original = await readFile(file, "utf8");
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const lines = original.split(/\r?\n/);
  let replaced = false;
  // Next.js expands unescaped `$NAME` sequences while loading dotenv files.
  // Password hashes use `$` as a delimiter, so persist them as `\$`.
  const dotenvValue = value.replace(/\$/g, "\\$");
  const updated = lines.map((line) => {
    if (!new RegExp(`^\\s*${key}\\s*=`).test(line)) return line;
    replaced = true;
    return `${key}=${dotenvValue}`;
  });
  if (!replaced) updated.push(`${key}=${dotenvValue}`);
  const target = resolve(file);
  const temporary = resolve(dirname(target), `.${randomBytes(8).toString("hex")}.tmp`);
  await writeFile(temporary, updated.join(newline), { encoding: "utf8", mode: 0o600, flag: "wx" });
  await rename(temporary, target);
  if (process.platform !== "win32") await chmod(target, 0o600);
}

export function readHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Требуется интерактивный терминал (TTY).");
  }
  process.stdout.write(prompt);
  return new Promise((resolvePromise, reject) => {
    let value = "";
    const finish = (error) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stdout.write("\n");
      if (error) reject(error); else resolvePromise(value);
    };
    const onData = (chunk) => {
      const input = chunk.toString("utf8");
      for (const character of input) {
        if (character === "\u0003") return finish(new Error("Операция отменена."));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else if (character >= " ") value += character;
      }
    };
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}
