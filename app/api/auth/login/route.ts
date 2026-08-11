import { NextResponse } from "next/server";
import { verifyClientCredentials } from "@/lib/auth/password";
import { createSessionToken, getSessionMaxAge, SESSION_COOKIE } from "@/lib/auth/session";
import { isSameOriginMutation } from "@/lib/security/api-access";
import { checkRateLimit, resetRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ success: false, error: "Недопустимый источник запроса." }, { status: 403 });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > 8_192) {
    return NextResponse.json({ success: false, error: "Тело запроса слишком большое." }, { status: 413 });
  }
  const rate = checkRateLimit(request, "login", 5, 15 * 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { success: false, error: "Слишком много попыток. Повторите позже." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }
  const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
  if (!verifyClientCredentials(body.username?.trim() ?? "", body.password ?? "")) {
    return NextResponse.json({ success: false, error: "Неверный логин или пароль." }, { status: 401 });
  }
  resetRateLimit(request, "login");
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(body.username!.trim()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionMaxAge(),
  });
  return response;
}
