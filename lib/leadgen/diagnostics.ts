import "server-only";

import { mutateLocalTable, readLocalTable } from "@/lib/leadgen/local-database";

export type MinimalDiagnostic = {
  id: string;
  stage: string;
  status: "ok" | "error" | "warning";
  reason: string;
  timestamp: string;
};

export async function recordDiagnostic(
  stage: string,
  status: MinimalDiagnostic["status"],
  reason: string,
) {
  const timestamp = new Date().toISOString();
  const safeReason = reason
    .replace(/(password|token|api[_-]?key|secret)(\s*[:=]\s*)[^\s;&]+/gi, "$1$2[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  const item: MinimalDiagnostic = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    stage: stage.slice(0, 80),
    status,
    reason: safeReason,
    timestamp,
  };
  await mutateLocalTable("leadgen_diagnostics", (rows) => rows.push(item));
  return item;
}

export async function listDiagnostics(limit = 50) {
  return (await readLocalTable<MinimalDiagnostic>("leadgen_diagnostics"))
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, Math.min(Math.max(limit, 1), 100));
}
