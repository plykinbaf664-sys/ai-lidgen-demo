import { requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";
import {
  auditSentMailboxArchive,
  backfillSentMailboxCopies,
  deduplicateSentMailboxCopies,
} from "@/lib/leadgen/sent-mail-archive";

export async function POST(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  const secret =
    process.env.OUTREACH_PROCESSOR_SECRET ?? process.env.CRON_SECRET;
  const encodedSecret = secret
    ? Buffer.from(secret, "utf8").toString("base64url")
    : null;
  if (
    !secret ||
    request.headers.get("x-outreach-processor-token") !== encodedSecret
  ) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("action") === "deduplicate") {
      return NextResponse.json({
        success: true,
        ...(await deduplicateSentMailboxCopies()),
      });
    }
    if (url.searchParams.get("action") === "audit") {
      return NextResponse.json({
        success: true,
        ...(await auditSentMailboxArchive()),
      });
    }
    return NextResponse.json({
      success: true,
      ...(await backfillSentMailboxCopies()),
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Не удалось выполнить служебную операцию.",
      },
      { status: 500 },
    );
  }
}
