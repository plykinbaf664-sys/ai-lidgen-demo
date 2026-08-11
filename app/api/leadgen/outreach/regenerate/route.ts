import { requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";
import { regenerateLatestUnsentOutreach } from "@/lib/leadgen/outreach-storage";
import { formatPublicError } from "@/lib/leadgen/error-format";

export async function POST(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  try {
    const body = (await request.json().catch(() => ({}))) as { execute?: boolean };
    const result = await regenerateLatestUnsentOutreach(body.execute === true);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: formatPublicError(error) },
      { status: 500 },
    );
  }
}
