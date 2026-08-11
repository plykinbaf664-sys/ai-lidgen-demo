import { requirePrivateApi } from "@/lib/security/api-access";
import { NextResponse } from "next/server";
import { listDiagnostics } from "@/lib/leadgen/diagnostics";
import { getLocalDatabaseStats } from "@/lib/leadgen/local-database";

export async function GET(request: Request) {
  const denied = await requirePrivateApi(request);
  if (denied) return denied;
  const tables = [
    "leadgen_campaigns",
    "leadgen_companies",
    "leadgen_contacts",
    "leadgen_outreach_queue",
    "leadgen_diagnostics",
  ];
  return NextResponse.json({
    success: true,
    storage_mode: "local",
    diagnostics: await listDiagnostics(),
    storage: await getLocalDatabaseStats(tables),
  });
}
