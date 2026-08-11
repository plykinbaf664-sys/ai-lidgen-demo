import { requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";
import { getRecentCampaigns } from "@/lib/leadgen/storage";
import { normalizeLeadgenStrings } from "@/lib/leadgen/text-normalization";
import { formatPublicError } from "@/lib/leadgen/error-format";

export async function GET(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  try {
    const campaigns = normalizeLeadgenStrings(
      await getRecentCampaigns(),
      "api.campaigns.response",
    );

    return NextResponse.json({
      success: true,
      campaigns,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: formatPublicError(error, "Не удалось загрузить историю кампаний."),
      },
      { status: 500 },
    );
  }
}
