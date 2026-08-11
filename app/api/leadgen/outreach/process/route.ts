import { NextResponse } from "next/server";
import { formatPublicError } from "@/lib/leadgen/error-format";
import { runOutreachProcessorIteration } from "@/lib/leadgen/outreach-scheduler";
import { getOutreachDeliveryStorageMode } from "@/lib/leadgen/local-outreach-store";
import { runLocalOutreachProcessorIteration } from "@/lib/leadgen/local-outreach-scheduler";
import { timingSafeEqual } from "node:crypto";
import { checkRateLimit } from "@/lib/security/rate-limit";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handleProcess(request: Request) {
  const secrets = [
    process.env.OUTREACH_PROCESSOR_SECRET,
    process.env.CRON_SECRET,
  ].filter((value): value is string => Boolean(value));
  const encodedSecrets = secrets.map((secret) =>
    Buffer.from(secret, "utf8").toString("base64url"),
  );
  const encodedToken = request.headers.get("x-outreach-processor-token");
  const authorization = request.headers.get("authorization");
  if (
    secrets.length === 0 ||
    (!encodedSecrets.some((secret) => safeEqual(secret, encodedToken ?? "")) &&
      !secrets.some((secret) => safeEqual(`Bearer ${secret}`, authorization ?? "")))
  ) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const rate = checkRateLimit(request, "processor", 12, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many processor requests" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }
  try {
    return NextResponse.json({
      success: true,
      storage_mode: getOutreachDeliveryStorageMode(),
      ...(getOutreachDeliveryStorageMode() === "local"
        ? await runLocalOutreachProcessorIteration()
        : await runOutreachProcessorIteration()),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: formatPublicError(error) }, { status: 500 });
  }
}

export const POST = handleProcess;

export async function GET() {
  return NextResponse.json({ success: false, error: "Method not allowed" }, { status: 405 });
}
