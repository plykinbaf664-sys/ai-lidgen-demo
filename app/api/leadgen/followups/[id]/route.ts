import { isBoundedString, isValidEmail, requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";
import { updateFollowup } from "@/lib/leadgen/followup-storage";
import { formatPublicError } from "@/lib/leadgen/error-format";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const patch = (await request.json()) as { subject?: string; body?: string; email?: string };
    if (
      (patch.subject !== undefined && !isBoundedString(patch.subject, 300, true)) ||
      (patch.body !== undefined && !isBoundedString(patch.body, 20_000, true)) ||
      (patch.email !== undefined && !isValidEmail(patch.email))
    ) {
      return NextResponse.json({ success: false, error: "Некорректные поля follow-up." }, { status: 400 });
    }
    return NextResponse.json({ success: true, entry: await updateFollowup(id, patch) });
  } catch (error) {
    return NextResponse.json({ success: false, error: formatPublicError(error) }, { status: 500 });
  }
}
