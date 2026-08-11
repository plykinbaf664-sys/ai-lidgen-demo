import { requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";
import { generateEligibleFollowups } from "@/lib/leadgen/followup-storage";
import { formatPublicError } from "@/lib/leadgen/error-format";

export async function POST(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as { campaignId?: string | null };
    return NextResponse.json({ success: true, ...(await generateEligibleFollowups(body.campaignId)) });
  } catch (error) {
    return NextResponse.json({ success: false, error: formatPublicError(error) }, { status: 500 });
  }
}
