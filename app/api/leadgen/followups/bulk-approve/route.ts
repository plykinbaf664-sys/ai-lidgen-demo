import { isValidEntityId, requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";
import {
  approveFollowups,
  getFollowupSummary,
} from "@/lib/leadgen/followup-storage";
import { formatPublicError } from "@/lib/leadgen/error-format";

export async function POST(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as {
      campaignId?: string;
      manual?: boolean;
    };
    const campaignId = body.campaignId || null;
    if (campaignId && !isValidEntityId(campaignId)) {
      return NextResponse.json({ success: false, error: "Некорректный campaignId." }, { status: 400 });
    }
    const result = await approveFollowups(
      undefined,
      campaignId,
      body.manual === true,
    );
    return NextResponse.json({
      success: true,
      ...result,
      summary: await getFollowupSummary(campaignId),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: formatPublicError(error) }, { status: 500 });
  }
}
