import { requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  return NextResponse.json(
    {
      success: false,
      error:
        "Прямая SMTP-отправка отключена. Используйте постановку в постоянную очередь.",
    },
    { status: 409 },
  );
}
