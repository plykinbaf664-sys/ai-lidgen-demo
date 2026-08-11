import "server-only";

import { mutateLocalTable, readLocalTable } from "@/lib/leadgen/local-database";
import {
  EMPTY_CLIENT_PROFILE,
  type ClientProfile,
  type ClientProfileSnapshot,
} from "@/lib/leadgen/client-profile-types";
import { getSegmentDefinition } from "@/lib/leadgen/segments";
import { PublicError } from "@/lib/leadgen/error-format";

const TABLE = "leadgen_client_profile";
const MAX_FIELD_LENGTH = 2_000;

function clean(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new PublicError("Поля ICP должны содержать текст.");
  if (value.length > MAX_FIELD_LENGTH) throw new PublicError(`Поле ICP не должно превышать ${MAX_FIELD_LENGTH} символов.`);
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").trim();
}

export function normalizeClientProfile(value: Partial<ClientProfile>): ClientProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PublicError("Некорректный формат ICP.");
  }
  const profile = {
    projectName: clean(value.projectName),
    productName: clean(value.productName),
    productDescription: clean(value.productDescription),
    primaryValue: clean(value.primaryValue),
    targetCustomer: clean(value.targetCustomer),
    industry: clean(value.industry),
    geography: clean(value.geography),
    companyType: clean(value.companyType),
    companySize: clean(value.companySize),
    targetProblems: clean(value.targetProblems),
    solvedProcesses: clean(value.solvedProcesses),
    desiredRoles: clean(value.desiredRoles),
    exclusions: clean(value.exclusions),
    offerContext: clean(value.offerContext),
    additionalContext: clean(value.additionalContext),
    updatedAt: new Date().toISOString(),
  };
  const total = Object.values(profile).reduce((sum, item) => sum + item.length, 0);
  if (total > 16_000) throw new PublicError("ICP превышает допустимый общий объём.");
  return profile;
}

export async function getClientProfile(): Promise<ClientProfile> {
  const row = (await readLocalTable<Record<string, unknown>>(TABLE))[0];
  if (!row) return EMPTY_CLIENT_PROFILE;
  return {
    ...normalizeClientProfile(row as Partial<ClientProfile>),
    updatedAt: clean(row.updatedAt),
  };
}

export async function saveClientProfile(value: Partial<ClientProfile>) {
  const profile = normalizeClientProfile(value);
  if (!profile.projectName || !profile.productName || !profile.targetCustomer) {
    throw new PublicError("Заполните название проекта, продукт и кого вы ищете.");
  }
  await mutateLocalTable(TABLE, (rows) => {
    rows.splice(0, rows.length, { id: "client", ...profile });
  });
  return profile;
}

export async function createClientProfileSnapshot({
  segmentId,
  segmentDescription,
}: {
  segmentId: string;
  segmentDescription?: string;
}): Promise<ClientProfileSnapshot> {
  const profile = await getClientProfile();
  if (!profile.projectName || !profile.productName || !profile.targetCustomer) {
    throw new PublicError("Сначала сохраните ICP клиента.");
  }
  const segment = getSegmentDefinition(segmentId);
  const custom = clean(segmentDescription);
  if (segment.id === "other" && !custom) {
    throw new PublicError("Для сегмента «Другое» добавьте свободное описание.");
  }
  return {
    ...profile,
    snapshotAt: new Date().toISOString(),
    segmentId: segment.id,
    segmentLabel: segment.id === "other" ? custom : segment.label,
    segmentDescription: custom,
  };
}
