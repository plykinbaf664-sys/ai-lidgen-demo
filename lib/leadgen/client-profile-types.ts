export type IcpEvidence<T> = {
  value: T | null;
  confidence: number | null;
  sourceExcerpt: string | null;
};

export type IcpAvatar = {
  name: string;
  priority: string | null;
  companyTypes: string[];
  qualifyingSignals: string[];
  businessProblems: string[];
  targetPersonas: string[];
  communicationAngle: string | null;
  confidence: number;
  sourceExcerpt: string | null;
};

export type IcpSignalStrategy = {
  description: string;
  relevance: string | null;
  evidenceSources: string[];
  relatedAvatars: string[];
  weight: number | null;
  confidence: number;
  sourceExcerpt: string | null;
};

export type IcpPersonaRule = {
  companyContext: string;
  targetPersonas: string[];
  rationale: string | null;
  relatedAvatars: string[];
  confidence: number;
  sourceExcerpt: string | null;
};

export type IcpQualificationRule = {
  criterion: string;
  type: "mandatory" | "preferred" | "exclusion";
  weight: number | null;
  threshold: string | null;
  confidence: number;
  sourceExcerpt: string | null;
};

export type IcpScoringRule = {
  criterion: string;
  score: number | null;
  condition: string | null;
  confidence: number;
  sourceExcerpt: string | null;
};

export type IcpIntelligence = {
  documentType: IcpEvidence<string>;
  product: IcpEvidence<string>;
  productDescription: IcpEvidence<string>;
  valueProposition: IcpEvidence<string>;
  outreachGoal: IcpEvidence<string>;
  targetCompanies: IcpEvidence<string[]>;
  segments: IcpEvidence<string[]>;
  mandatoryCriteria: IcpEvidence<string[]>;
  preferredCriteria: IcpEvidence<string[]>;
  exclusionCriteria: IcpEvidence<string[]>;
  businessProblems: IcpEvidence<string[]>;
  buyingContext: IcpEvidence<string[]>;
  targetPersonas: IcpEvidence<string[]>;
  companyEconomics: IcpEvidence<string[]>;
  companySizeConstraints: IcpEvidence<string[]>;
  geography: IcpEvidence<string[]>;
  personalizationRules: IcpEvidence<string[]>;
  offerAngles: IcpEvidence<string[]>;
  cta: IcpEvidence<string>;
  restrictions: IcpEvidence<string[]>;
  compliance: IcpEvidence<string[]>;
  additionalContext: IcpEvidence<string[]>;
  avatars: IcpAvatar[];
  signals: IcpSignalStrategy[];
  personaRules: IcpPersonaRule[];
  qualificationRules: IcpQualificationRule[];
  scoringRules: IcpScoringRule[];
};

export type ClientProfile = {
  projectName: string;
  productName: string;
  productDescription: string;
  primaryValue: string;
  targetCustomer: string;
  industry: string;
  geography: string;
  companyType: string;
  companySize: string;
  targetProblems: string;
  solvedProcesses: string;
  desiredRoles: string;
  exclusions: string;
  offerContext: string;
  additionalContext: string;
  intelligenceSummary: string;
  intelligence: IcpIntelligence | null;
  updatedAt: string;
};

export type ClientProfileSnapshot = ClientProfile & {
  snapshotAt: string;
  segmentId: string;
  segmentLabel: string;
  segmentDescription: string;
};

export const EMPTY_CLIENT_PROFILE: ClientProfile = {
  projectName: "",
  productName: "",
  productDescription: "",
  primaryValue: "",
  targetCustomer: "",
  industry: "",
  geography: "",
  companyType: "",
  companySize: "",
  targetProblems: "",
  solvedProcesses: "",
  desiredRoles: "",
  exclusions: "",
  offerContext: "",
  additionalContext: "",
  intelligenceSummary: "",
  intelligence: null,
  updatedAt: "",
};

export function splitProfileTerms(value: string): string[] {
  return [...new Set(value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean))].slice(0, 24);
}

export function compactProfile(profile: ClientProfile | ClientProfileSnapshot) {
  const intelligence = profile.intelligence;
  return {
    project: profile.projectName,
    product: profile.productName,
    product_description: profile.productDescription,
    value: profile.primaryValue,
    target_customer: profile.targetCustomer,
    industry: profile.industry,
    geography: profile.geography,
    company_type: profile.companyType,
    company_size: profile.companySize,
    pains: splitProfileTerms(profile.targetProblems),
    processes: splitProfileTerms(profile.solvedProcesses),
    roles: splitProfileTerms(profile.desiredRoles),
    exclusions: splitProfileTerms(profile.exclusions),
    offer_context: profile.offerContext,
    context: profile.additionalContext,
    intelligence_summary: profile.intelligenceSummary,
    avatars: intelligence?.avatars.slice(0, 8).map((avatar) => ({
      name: avatar.name,
      priority: avatar.priority,
      company_types: avatar.companyTypes.slice(0, 8),
      qualifying_signals: avatar.qualifyingSignals.slice(0, 8),
      target_personas: avatar.targetPersonas.slice(0, 8),
      communication_angle: avatar.communicationAngle,
    })) ?? [],
    mandatory_criteria: intelligence?.mandatoryCriteria.value?.slice(0, 16) ?? [],
    preferred_criteria: intelligence?.preferredCriteria.value?.slice(0, 16) ?? [],
    signal_strategy: intelligence?.signals.slice(0, 16).map((signal) => ({
      description: signal.description,
      relevance: signal.relevance,
      evidence_sources: signal.evidenceSources.slice(0, 6),
      related_avatars: signal.relatedAvatars.slice(0, 6),
      weight: signal.weight,
    })) ?? [],
    persona_rules: intelligence?.personaRules.slice(0, 12).map((rule) => ({
      context: rule.companyContext,
      personas: rule.targetPersonas.slice(0, 8),
      rationale: rule.rationale,
    })) ?? [],
    qualification_rules: intelligence?.qualificationRules.slice(0, 20).map((rule) => ({
      criterion: rule.criterion,
      type: rule.type,
      weight: rule.weight,
      threshold: rule.threshold,
    })) ?? [],
    scoring_rules: intelligence?.scoringRules.slice(0, 20).map((rule) => ({
      criterion: rule.criterion,
      score: rule.score,
      condition: rule.condition,
    })) ?? [],
    personalization_rules: intelligence?.personalizationRules.value?.slice(0, 12) ?? [],
    cta: intelligence?.cta.value ?? "",
    restrictions: intelligence?.restrictions.value?.slice(0, 12) ?? [],
  };
}
