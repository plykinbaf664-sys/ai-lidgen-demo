import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  const length = Math.max(a.length, b.length, 1);
  const paddedA = Buffer.alloc(length);
  const paddedB = Buffer.alloc(length);
  a.copy(paddedA);
  b.copy(paddedB);
  return timingSafeEqual(paddedA, paddedB) && a.length === b.length;
}

export function isSafeAuthUsername(value) {
  return typeof value === "string"
    && value.length <= 254
    && value === value.trim()
    && EMAIL_PATTERN.test(value)
    && !/^mailto:/i.test(value)
    && !/["'`\[\]()]/.test(value);
}

export function parsePasswordHash(value) {
  if (typeof value !== "string" || value !== value.trim()) return null;
  const parts = value.split("$");
  if (parts.length !== 3) return null;
  const [algorithm, salt, encodedHash] = parts;
  if (algorithm !== "scrypt" || salt.length < 8 || salt.length > 128) return null;
  if (!BASE64URL_PATTERN.test(encodedHash)) return null;
  const hash = Buffer.from(encodedHash, "base64url");
  if (hash.length < 32 || hash.length > 128 || hash.toString("base64url") !== encodedHash) return null;
  return { salt, hash };
}

export function createPasswordHash(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 1_024) {
    throw new Error("Пароль должен содержать от 12 до 1024 символов.");
  }
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

export function verifyClientCredentials(username, password) {
  return diagnoseClientCredentials(username, password).valid;
}

export function diagnoseClientCredentials(username, password) {
  const expectedUsername = process.env.AUTH_USERNAME;
  const parsed = parsePasswordHash(process.env.AUTH_PASSWORD_HASH);
  if (!isSafeAuthUsername(expectedUsername) || !parsed) return { valid: false, reason: "auth_config_invalid" };
  if (typeof username !== "string" || typeof password !== "string" || username.length > 254 || password.length > 1_024) {
    return { valid: false, reason: "credential_input_invalid" };
  }
  try {
    const actual = scryptSync(password, parsed.salt, parsed.hash.length);
    const usernameValid = safeEqual(username, expectedUsername);
    const passwordValid = timingSafeEqual(parsed.hash, actual);
    if (!usernameValid) return { valid: false, reason: "username_mismatch" };
    if (!passwordValid) return { valid: false, reason: "password_mismatch" };
    return { valid: true, reason: "ok" };
  } catch {
    return { valid: false, reason: "credential_crypto_error" };
  }
}
