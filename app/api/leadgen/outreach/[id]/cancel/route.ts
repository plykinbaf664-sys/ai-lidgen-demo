import { requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";
import { cancelQueuedItem } from "@/lib/leadgen/outreach-storage";
import { formatPublicError } from "@/lib/leadgen/error-format";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requirePrivateApi(_request);
  if (denied) return denied;
  try {
    const entry = await cancelQueuedItem((await params).id);
    if (!entry) return NextResponse.json({ success: false, error: "Письмо не найдено в очереди" }, { status: 404 });
    return NextResponse.json({ success: true, entry });
  } catch (error) {
    return NextResponse.json({ success: false, error: formatPublicError(error) }, { status: 500 });
  }
}
