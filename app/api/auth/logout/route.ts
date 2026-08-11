import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { requirePrivateApi } from "@/lib/security/api-access";

export async function POST(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
