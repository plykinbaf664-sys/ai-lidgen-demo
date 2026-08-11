import { requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";
import { reprocessLatestCampaignEmailDiscovery } from "@/lib/leadgen/email-discovery-reprocess";
import { formatPublicError } from "@/lib/leadgen/error-format";

export const maxDuration = 300;

export async function POST(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      dryRun?: boolean;
    };
    const result = await reprocessLatestCampaignEmailDiscovery({
      dryRun: body.dryRun !== false,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: formatPublicError(
          error,
          "Не удалось повторно выполнить Email Discovery.",
        ),
      },
      { status: 500 },
    );
  }
}
