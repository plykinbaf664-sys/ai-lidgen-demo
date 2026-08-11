import { isValidEntityId, requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";
import { bulkApproveOutreach } from "@/lib/leadgen/outreach-storage";
import { formatPublicError } from "@/lib/leadgen/error-format";
import { getOutreachSummary } from "@/lib/leadgen/outreach-summary";

export async function POST(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as { campaignId?: string; execute?: boolean };
    if (!isValidEntityId(body.campaignId)) return NextResponse.json({ success: false, error: "campaignId обязателен" }, { status: 400 });
    const result = await bulkApproveOutreach(
      body.campaignId,
      body.execute === true,
    );
    return NextResponse.json({
      success: true,
      ...result,
      summary:
        body.execute === true
          ? await getOutreachSummary(body.campaignId)
          : undefined,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: formatPublicError(error) }, { status: 500 });
  }
}
