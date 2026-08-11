import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

function securityPolicy(nonce: string) {
  const development = process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
  ].join("; ");
}

function secure(response: NextResponse, policy: string) {
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const nonceBytes = new Uint8Array(18);
  crypto.getRandomValues(nonceBytes);
  const nonce = Buffer.from(nonceBytes).toString("base64");
  const policy = securityPolicy(nonce);
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.delete("x-leadgen-authenticated");
  forwardedHeaders.set("x-nonce", nonce);
  forwardedHeaders.set("Content-Security-Policy", policy);
  if (
    path === "/login" ||
    path === "/api/auth/login" ||
    path === "/api/leadgen/outreach/process" ||
    path.startsWith("/_next/") ||
    path === "/favicon.ico"
  ) {
    return secure(NextResponse.next({ request: { headers: forwardedHeaders } }), policy);
  }
  const authenticated = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (authenticated) {
    forwardedHeaders.set("x-leadgen-authenticated", "1");
    return secure(NextResponse.next({ request: { headers: forwardedHeaders } }), policy);
  }
  if (path.startsWith("/api/")) {
    return secure(NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }), policy);
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", path);
  return secure(NextResponse.redirect(login), policy);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
