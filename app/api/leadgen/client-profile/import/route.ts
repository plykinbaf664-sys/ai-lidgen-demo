import { NextResponse } from "next/server";
import { requirePrivateApi } from "@/lib/security/api-access";
import { formatPublicError, PublicError } from "@/lib/leadgen/error-format";
import { extractIcpDocument } from "@/lib/leadgen/icp-document-extractor";
import { parseIcpDocumentText } from "@/lib/leadgen/icp-document-parser";

export const maxDuration = 90;

export async function POST(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  try {
    const form = await request.formData().catch(() => null);
    const upload = form?.get("file");
    if (!(upload instanceof File)) throw new PublicError("Выберите PDF, DOCX или TXT.");
    const extracted = await extractIcpDocument({
      name: upload.name,
      mimeType: upload.type,
      bytes: Buffer.from(await upload.arrayBuffer()),
    });
    const preview = await parseIcpDocumentText(extracted.text);
    return NextResponse.json({
      success: true,
      preview,
      document: { kind: extracted.kind, truncated: extracted.truncated },
    });
  } catch (error) {
    const status = error instanceof PublicError ? error.status : 500;
    return NextResponse.json(
      { success: false, error: formatPublicError(error, "Не удалось безопасно обработать документ.") },
      { status },
    );
  }
}
