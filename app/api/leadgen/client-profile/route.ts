import { requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";
import { getClientProfile, saveClientProfile } from "@/lib/leadgen/client-profile";
import { SEGMENTS } from "@/lib/leadgen/segments";
import { formatPublicError } from "@/lib/leadgen/error-format";

export async function GET(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  return NextResponse.json({
    success: true,
    profile: await getClientProfile(),
    segments: SEGMENTS,
  });
}

export async function PUT(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  try {
    const profile = await saveClientProfile(await request.json());
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: formatPublicError(error) },
      { status: 400 },
    );
  }
}
