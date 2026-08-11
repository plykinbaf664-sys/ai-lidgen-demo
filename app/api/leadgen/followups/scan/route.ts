import { requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";
import { scanFollowupReplies } from "@/lib/leadgen/followup-storage";
import { formatPublicError } from "@/lib/leadgen/error-format";

export async function POST(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  try {
    const result = await scanFollowupReplies();
    if (result.error) {
      return NextResponse.json(
        { success: false, ...result },
        { status: 503 },
      );
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: formatPublicError(error, "Не удалось проверить ответы."),
      },
      { status: 409 },
    );
  }
}
