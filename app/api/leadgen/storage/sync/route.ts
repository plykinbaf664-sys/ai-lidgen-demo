import { requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  return NextResponse.json(
    {
      success: false,
      error: "Удалённая синхронизация отключена в автономной клиентской версии.",
      storage_mode: "local",
    },
    { status: 410 },
  );
}
