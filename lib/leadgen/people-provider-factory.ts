import { MockPeopleProvider } from "@/lib/leadgen/mock-people-provider";
import type { PeopleEnrichmentProvider } from "@/lib/leadgen/people-provider";
import { RuPublicPeopleProvider } from "@/lib/leadgen/ru-public-people-provider";

type PeopleProviderMode =
  | "auto"
  | "ru_public"
  | "mock";

const defaultProviderOrder: PeopleProviderMode[] = ["ru_public"];

function isProviderMode(value: string): value is PeopleProviderMode {
  return [
    "auto",
    "ru_public",
    "mock",
  ].includes(value);
}

function getProviderOrder(): PeopleProviderMode[] {
  const raw = process.env.LEADGEN_PEOPLE_PROVIDERS?.trim();

  if (!raw) {
    return defaultProviderOrder;
  }

  const modes = raw
    .split(",")
    .map((mode) => mode.trim().toLowerCase())
    .filter(isProviderMode)
    .filter((mode) => mode !== "auto")

  return modes.length > 0 ? modes : defaultProviderOrder;
}

function isConfigured(mode: PeopleProviderMode): boolean {
  if (mode === "ru_public") {
    return true;
  }

  return mode === "mock" && process.env.LEADGEN_ALLOW_MOCK_PEOPLE === "true";
}

function createProvider(mode: PeopleProviderMode): PeopleEnrichmentProvider | null {
  if (!isConfigured(mode)) {
    return null;
  }

  if (mode === "ru_public") {
    return new RuPublicPeopleProvider();
  }

  if (mode === "mock") {
    return new MockPeopleProvider();
  }

  return null;
}

export function createPeopleProviders(): PeopleEnrichmentProvider[] {
  return getProviderOrder()
    .map(createProvider)
    .filter((provider): provider is PeopleEnrichmentProvider => Boolean(provider));
}
