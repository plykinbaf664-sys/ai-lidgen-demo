import { resolve } from "node:path";
import { createPasswordHash, isSafeAuthUsername, verifyClientCredentials } from "../lib/auth/password-core.mjs";
import { argument, loadEnvFile, readHidden, updateEnvValue } from "./auth-cli-utils.mjs";

const envFile = resolve(argument("--env-file", ".env.local"));

try {
  await loadEnvFile(envFile);
  if (!isSafeAuthUsername(process.env.AUTH_USERNAME)) {
    throw new Error("AUTH_USERNAME отсутствует или не является обычным email без кавычек/markdown.");
  }
  const password = await readHidden("Новый пароль: ");
  const confirmation = await readHidden("Повторите пароль: ");
  if (password !== confirmation) throw new Error("Пароли не совпадают.");
  const hash = createPasswordHash(password);
  process.env.AUTH_PASSWORD_HASH = hash;
  if (!verifyClientCredentials(process.env.AUTH_USERNAME, password)) {
    throw new Error("Самопроверка созданного hash не пройдена; env не изменён.");
  }
  await updateEnvValue(envFile, "AUTH_PASSWORD_HASH", hash);
  process.stdout.write(`AUTH_PASSWORD_HASH безопасно обновлён в ${envFile}.\n`);
  process.stdout.write("Самопроверка credentials: PASS.\n");
  process.stdout.write(`Логин: ${process.env.AUTH_USERNAME}\n`);
  process.stdout.write("Далее: npm run auth:test -- --env-file <этот файл>, затем перезапустите PM2 с актуальным environment.\n");
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Не удалось обновить пароль."}\n`);
  process.exitCode = 1;
}
