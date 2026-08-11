import { isBoundedString, isValidEmail, requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";
import { getOutreachQueueEntry, updateOutreachQueueEntry } from "@/lib/leadgen/outreach-storage";
import { formatPublicError } from "@/lib/leadgen/error-format";
import type { OutreachEmailStatus } from "@/lib/leadgen/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requirePrivateApi(_request);
  if (denied) return denied;
  try {
    const entry = await getOutreachQueueEntry((await params).id);
    if (!entry) return NextResponse.json({ success: false, error: "Письмо не найдено" }, { status: 404 });
    return NextResponse.json({ success: true, entry });
  } catch (error) {
    return NextResponse.json({ success: false, error: formatPublicError(error) }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as {
      subject?: string;
      body?: string;
      email?: string;
      status?: OutreachEmailStatus;
      note?: string;
    };
    if (
      (body.subject !== undefined && !isBoundedString(body.subject, 300, true)) ||
      (body.body !== undefined && !isBoundedString(body.body, 20_000, true)) ||
      (body.note !== undefined && !isBoundedString(body.note, 2_000, true)) ||
      (body.email !== undefined && !isValidEmail(body.email))
    ) {
      return NextResponse.json({ success: false, error: "Некорректные поля письма." }, { status: 400 });
    }
    if (
      body.status &&
      !["needs_review", "paused", "rejected"].includes(body.status)
    ) {
      return NextResponse.json(
        { success: false, error: "Этот статус нельзя установить вручную" },
        { status: 400 },
      );
    }
    const entry = await updateOutreachQueueEntry({ id: (await params).id, ...body });
    if (!entry) return NextResponse.json({ success: false, error: "Письмо не найдено" }, { status: 404 });
    return NextResponse.json({ success: true, entry });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: formatPublicError(error) },
      { status: 500 },
    );
  }
}
