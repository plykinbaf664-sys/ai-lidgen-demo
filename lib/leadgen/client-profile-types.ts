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
  updatedAt: "",
};

export function splitProfileTerms(value: string): string[] {
  return [...new Set(value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean))].slice(0, 24);
}

export function compactProfile(profile: ClientProfile | ClientProfileSnapshot) {
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
  };
}
