import "server-only";

import { scryptSync, timingSafeEqual } from "node:crypto";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  const length = Math.max(a.length, b.length, 1);
  const paddedA = Buffer.alloc(length);
  const paddedB = Buffer.alloc(length);
  a.copy(paddedA);
  b.copy(paddedB);
  return timingSafeEqual(paddedA, paddedB) && a.length === b.length;
}

export function verifyClientCredentials(username: string, password: string) {
  const expectedUsername = process.env.AUTH_USERNAME?.trim();
  const passwordHash = process.env.AUTH_PASSWORD_HASH?.trim();
  if (!expectedUsername || !passwordHash || username.length > 128 || password.length > 1_024) return false;
  const [algorithm, salt, encodedHash] = passwordHash.split("$");
  if (algorithm !== "scrypt" || !salt || !encodedHash) return false;
  try {
    const expected = Buffer.from(encodedHash, "base64url");
    const actual = scryptSync(password, salt, expected.length);
    const passwordMatches = expected.length === actual.length && timingSafeEqual(expected, actual);
    return safeEqual(username, expectedUsername) && passwordMatches;
  } catch {
    return false;
  }
}
