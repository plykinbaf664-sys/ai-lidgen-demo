import { LEADGEN_VERTICALS, type LeadgenVerticalId } from "@/lib/leadgen/verticals";

export type SegmentDefinition = {
  id: string;
  label: string;
  verticalId: LeadgenVerticalId | null;
};

export const SEGMENTS: SegmentDefinition[] = [
  { id: "real_estate", label: "Недвижимость", verticalId: "real_estate" },
  { id: "manufacturing", label: "Промышленность", verticalId: "manufacturing" },
  { id: "medicine", label: "Медицина", verticalId: "medicine" },
  { id: "dentistry", label: "Стоматологии", verticalId: "dentistry" },
  { id: "construction", label: "Строительство", verticalId: "construction" },
  { id: "logistics", label: "Логистика", verticalId: "logistics" },
  { id: "it", label: "IT", verticalId: "it" },
  { id: "marketing_agencies", label: "Маркетинговые агентства", verticalId: "marketing_agencies" },
  { id: "education", label: "Образование", verticalId: "education" },
  { id: "other", label: "Другое", verticalId: null },
];

export function getSegmentDefinition(value?: string | null): SegmentDefinition {
  return SEGMENTS.find((segment) => segment.id === value) ?? SEGMENTS[1];
}

export function getSegmentContext(value?: string | null) {
  const segment = getSegmentDefinition(value);
  return segment.verticalId ? LEADGEN_VERTICALS[segment.verticalId] : null;
}
