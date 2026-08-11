import { requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";
import { approveFollowups } from "@/lib/leadgen/followup-storage";
import { formatPublicError } from "@/lib/leadgen/error-format";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requirePrivateApi(_request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    return NextResponse.json({ success: true, ...(await approveFollowups([id])) });
  } catch (error) {
    return NextResponse.json({ success: false, error: formatPublicError(error) }, { status: 500 });
  }
}
