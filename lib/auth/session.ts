export const SESSION_COOKIE = process.env.NODE_ENV === "production"
  ? "__Host-leadgen_client_session"
  : "leadgen_client_session";

function sessionTtlSeconds() {
  const minutes = Number(process.env.AUTH_SESSION_TTL_MINUTES ?? 480);
  return Math.min(1_440, Math.max(15, Number.isFinite(minutes) ? minutes : 480)) * 60;
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

async function sign(value: string) {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Buffer.from(signature).toString("base64url");
}

async function verifySignature(value: string, supplied: string) {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      "HMAC",
      key,
      Buffer.from(supplied, "base64url"),
      new TextEncoder().encode(value),
    );
  } catch {
    return false;
  }
}

export async function createSessionToken(username: string) {
  const now = Math.floor(Date.now() / 1000);
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const payload = encode(JSON.stringify({
    username,
    iat: now,
    exp: now + sessionTtlSeconds(),
    jti: Buffer.from(bytes).toString("base64url"),
  }));
  const signature = await sign(payload);
  if (!signature) throw new Error("AUTH_SESSION_SECRET должен содержать минимум 32 символа.");
  return `${payload}.${signature}`;
}

export async function verifySessionToken(token?: string | null) {
  if (!token) return false;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return false;
  if (!(await verifySignature(payload, suppliedSignature))) return false;
  try {
    const parsed = JSON.parse(decode(payload)) as { exp?: number; iat?: number; jti?: string; username?: string };
    const now = Math.floor(Date.now() / 1000);
    return Boolean(
      parsed.username && parsed.jti && parsed.iat && parsed.exp &&
      parsed.iat <= now + 60 && parsed.exp > now && parsed.exp - parsed.iat <= 86_400,
    );
  } catch {
    return false;
  }
}

export function getSessionMaxAge() {
  return sessionTtlSeconds();
}
