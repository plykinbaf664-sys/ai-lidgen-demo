import { requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";
import { diagnoseImapConnection } from "@/lib/leadgen/imap-reply-detector";
import { formatPublicError } from "@/lib/leadgen/error-format";

export async function POST(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  try {
    const diagnostic = await diagnoseImapConnection();
    return NextResponse.json({
      success: diagnostic.status === "connected",
      diagnostic,
    }, { status: diagnostic.status === "connected" ? 200 : 503 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: formatPublicError(error, "Не удалось проверить IMAP."),
    }, { status: 500 });
  }
}
