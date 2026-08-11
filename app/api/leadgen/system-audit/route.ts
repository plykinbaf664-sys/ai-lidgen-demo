import { requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";
import { auditProductionConsistency, repairProductionConsistency } from "@/lib/leadgen/production-consistency";
import { formatPublicError } from "@/lib/leadgen/error-format";

function authorized(request: Request) {
  const secret = process.env.OUTREACH_PROCESSOR_SECRET ?? process.env.CRON_SECRET;
  if (!secret) return false;
  const encoded = Buffer.from(secret, "utf8").toString("base64url");
  return request.headers.get("x-outreach-processor-token") === encoded ||
    request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ success: true, audit: await auditProductionConsistency() });
  } catch (error) {
    return NextResponse.json({ success: false, error: formatPublicError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ success: true, result: await repairProductionConsistency() });
  } catch (error) {
    return NextResponse.json({ success: false, error: formatPublicError(error) }, { status: 500 });
  }
}
