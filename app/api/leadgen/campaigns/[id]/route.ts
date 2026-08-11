import { requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";
import { getCampaignDetails } from "@/lib/leadgen/storage";
import { normalizeLeadgenStrings } from "@/lib/leadgen/text-normalization";
import { formatPublicError } from "@/lib/leadgen/error-format";

type CampaignDetailsRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: CampaignDetailsRouteContext,
) {
  const denied = await requirePrivateApi(_request);
  if (denied) return denied;
  try {
    const { id } = await params;
    const details = await getCampaignDetails(id);

    if (!details) {
      return NextResponse.json(
        {
          success: false,
          error: "Кампания не найдена",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      details: normalizeLeadgenStrings(details, "api.campaign_details.response"),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: formatPublicError(error, "Не удалось загрузить кампанию."),
      },
      { status: 500 },
    );
  }
}
