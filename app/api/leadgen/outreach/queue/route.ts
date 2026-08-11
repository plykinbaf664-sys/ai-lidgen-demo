import { isValidEntityId, requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";
import {
  getOutreachOperationalState,
  getDailySendStats,
  syncOutreachQueue,
} from "@/lib/leadgen/outreach-storage";
import { formatPublicError } from "@/lib/leadgen/error-format";

export async function POST(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  try {
    const { campaignId } = (await request.json()) as { campaignId?: string };
    if (!isValidEntityId(campaignId)) {
      return NextResponse.json({ success: false, error: "campaignId обязателен" }, { status: 400 });
    }
    const entries = await syncOutreachQueue(campaignId);
    const daily = await getDailySendStats();
    return NextResponse.json({
      success: true,
      entries,
      operational: await getOutreachOperationalState(entries),
      daily: {
        sent_today: daily.sentToday,
        daily_limit: daily.dailyLimit,
        daily_remaining: daily.availableToQueue,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: formatPublicError(error) },
      { status: 500 },
    );
  }
}
