import "server-only";

import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/security/rate-limit";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ENTITY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

function cookieValue(request: Request, name: string) {
  for (const item of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function expectedOrigins(request: Request) {
  const origins = new Set<string>();
  const configured = process.env.LEADGEN_BASE_URL?.trim();
  if (configured) {
    try { origins.add(new URL(configured).origin); } catch { /* invalid config is ignored here */ }
  }
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "");
  if (host && (protocol === "http" || protocol === "https")) origins.add(`${protocol}://${host}`);
  origins.add(new URL(request.url).origin);
  return origins;
}

export function isSameOriginMutation(request: Request) {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return true;
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") return false;
  try {
    return expectedOrigins(request).has(new URL(origin).origin);
  } catch {
    return false;
  }
}

function policyFor(pathname: string, method: string) {
  if (pathname.includes("/client-profile/import")) return ["upload", 5, 10 * 60_000] as const;
  if (pathname === "/api/leadgen/run" || pathname.includes("search-test") || pathname.includes("signal-pipeline-test")) {
    return ["search", 5, 10 * 60_000] as const;
  }
  if (pathname.includes("generate") || pathname.includes("regenerate")) return ["generation", 10, 10 * 60_000] as const;
  if (pathname.includes("/imap/")) return ["imap", 6, 5 * 60_000] as const;
  if (pathname.includes("outreach") || pathname.includes("followups")) return ["mail-action", 40, 5 * 60_000] as const;
  return [`api-${method.toLowerCase()}`, method === "GET" ? 180 : 60, 5 * 60_000] as const;
}

export async function requirePrivateApi(request: Request): Promise<NextResponse | null> {
  const authenticated = await verifySessionToken(cookieValue(request, SESSION_COOKIE));
  if (!authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ success: false, error: "Недопустимый источник запроса." }, { status: 403 });
  }
  const url = new URL(request.url);
  if (url.toString().length > 4_096) {
    return NextResponse.json({ success: false, error: "Запрос слишком длинный." }, { status: 414 });
  }
  for (const segment of url.pathname.split("/").filter(Boolean)) {
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(segment)) {
      return NextResponse.json({ success: false, error: "Некорректный путь запроса." }, { status: 400 });
    }
  }
  for (const [key, value] of url.searchParams) {
    const max = key === "query" ? 500 : 2_000;
    if (key.length > 80 || value.length > max) {
      return NextResponse.json({ success: false, error: "Параметр запроса слишком длинный." }, { status: 400 });
    }
    if (/id$/i.test(key) && !isValidEntityId(value)) {
      return NextResponse.json({ success: false, error: "Некорректный ID." }, { status: 400 });
    }
  }
  const maxBody = url.pathname.includes("/client-profile/import")
    ? getIcpUploadLimit() + 256_000
    : 256_000;
  const length = Number(request.headers.get("content-length") ?? 0);
  if (url.pathname.includes("/client-profile/import") && (!Number.isFinite(length) || length <= 0)) {
    return NextResponse.json({ success: false, error: "Для upload требуется Content-Length." }, { status: 411 });
  }
  if (Number.isFinite(length) && length > maxBody) {
    return NextResponse.json({ success: false, error: "Тело запроса слишком большое." }, { status: 413 });
  }
  const [scope, limit, windowMs] = policyFor(url.pathname, request.method.toUpperCase());
  const rate = checkRateLimit(request, scope, limit, windowMs);
  if (!rate.allowed) {
    return NextResponse.json(
      { success: false, error: "Слишком много запросов. Повторите позже." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }
  return null;
}

export function isValidEntityId(value: unknown): value is string {
  return typeof value === "string" && ENTITY_ID_PATTERN.test(value);
}

export function isBoundedString(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === "string" && value.length <= max && (allowEmpty || value.trim().length > 0);
}

export function isValidEmail(value: unknown): value is string {
  return isBoundedString(value, 254) && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);
}

export function getIcpUploadLimit() {
  const configured = Number(process.env.ICP_UPLOAD_MAX_BYTES ?? 2_000_000);
  return Number.isInteger(configured)
    ? Math.min(5_000_000, Math.max(64_000, configured))
    : 2_000_000;
}
