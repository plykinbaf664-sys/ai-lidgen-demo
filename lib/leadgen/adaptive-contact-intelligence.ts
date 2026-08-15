import { resolveMx } from "node:dns/promises";
import type {
  ContactDiscoveryResult,
  ContactIntelligenceEvidence,
  ContactIntelligenceResult,
  DecisionMakerProfile,
  LeadgenCompany,
  LeadgenContact,
  PeopleDiscoveryResult,
  PersonCandidate,
} from "@/lib/leadgen/types";
import {
  resolvePersonalLprEmail,
  type MxVerification,
} from "@/lib/leadgen/personal-lpr-email-resolver";

export {
  applyCorporateEmailPattern,
  inferCorporateEmailPattern,
  transliteratePersonPart,
} from "@/lib/leadgen/personal-lpr-email-resolver";

const MX_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const MX_TIMEOUT_MS = 2_500;
const mxCache = new Map<string, { expiresAt: number; value: Promise<MxVerification> }>();

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function getContactedPersonKey(companyName: string, personName: string): string {
  return `${normalize(companyName)}|${normalize(personName)}`;
}

function getDomain(value: string | null | undefined): string | null {
  const candidate = (value ?? "").trim().toLowerCase();
  if (!candidate) return null;
  try {
    return new URL(candidate.includes("://") ? candidate : `https://${candidate}`).hostname
      .replace(/^www\./, "");
  } catch {
    return candidate.replace(/^www\./, "").split("/")[0] || null;
  }
}

function getEmailDomain(email: string | null | undefined): string | null {
  const parts = (email ?? "").trim().toLowerCase().split("@");
  return parts.length === 2 && parts[1] ? parts[1] : null;
}

async function domainHasMx(domain: string | null): Promise<MxVerification> {
  if (!domain) return false;
  const cached = mxCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = (async (): Promise<MxVerification> => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const records = await Promise.race([
          resolveMx(domain),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("mx_timeout")), MX_TIMEOUT_MS)),
        ]);
        return records.length > 0;
      } catch (error) {
        if (error instanceof Error && /ENOTFOUND|ENODATA/i.test(error.message)) return false;
      }
    }
    return "unknown";
  })();
  mxCache.set(domain, { expiresAt: Date.now() + MX_CACHE_TTL_MS, value });
  return value;
}

function sourceLooksLikeRegistry(url: string | null | undefined): boolean {
  const host = getDomain(url);
  return Boolean(host && /(?:rusprofile|spark-interfax|list-org|checko|audit-it)\./.test(host));
}

function choosePerson(people: PeopleDiscoveryResult): PersonCandidate | null {
  return people.primary_person ?? people.alternative_people[0] ?? null;
}

function compactEvidence(items: ContactIntelligenceEvidence[]): ContactIntelligenceEvidence[] {
  return items
    .filter((item, index, all) =>
      all.findIndex((candidate) => candidate.kind === item.kind && candidate.summary === item.summary) === index,
    )
    .slice(0, 8);
}

export async function evaluateAdaptiveContactIntelligence({
  company,
  decisionMaker,
  peopleDiscovery,
  contactDiscovery,
  knownPersonKeys = [],
  verifyMx = domainHasMx,
}: {
  company: LeadgenCompany;
  decisionMaker: DecisionMakerProfile;
  peopleDiscovery: PeopleDiscoveryResult;
  contactDiscovery: ContactDiscoveryResult;
  knownPersonKeys?: Iterable<string>;
  verifyMx?: (domain: string | null) => Promise<MxVerification>;
}): Promise<ContactIntelligenceResult> {
  const person = choosePerson(peopleDiscovery);
  const officialDomain = getDomain(
    contactDiscovery.resolved_official_domain ?? contactDiscovery.official_website ?? company.company_domain,
  );
  const directContacts = contactDiscovery.contacts
    .filter((contact) => contact.contact_type === "work_email" && contact.email && contact.full_name)
    .sort((left, right) => {
      const primaryName = normalize(person?.full_name);
      return Number(normalize(right.full_name) === primaryName) - Number(normalize(left.full_name) === primaryName) ||
        right.confidence_score - left.confidence_score;
    });
  const direct = person
    ? directContacts.find((contact) => normalize(contact.full_name) === normalize(person.full_name)) ?? null
    : directContacts[0] ?? null;
  const selectedPersonName = person?.full_name ?? direct?.full_name ?? null;
  const selectedRole = person?.role_title ?? direct?.role_title ?? null;
  const isRoutingContact = direct?.metadata.contact_route === "corporate_router";
  const duplicatePerson = selectedPersonName
    ? new Set(knownPersonKeys).has(getContactedPersonKey(company.company_name, selectedPersonName))
    : false;
  const directDomain = getEmailDomain(direct?.email);
  const sourceDomain = getDomain(direct?.source_url);
  const aliasPublishedOnOfficialSite = Boolean(
    directDomain && officialDomain && directDomain !== officialDomain && sourceDomain === officialDomain,
  );
  const domainMatch = Boolean(directDomain && officialDomain && (
    directDomain === officialDomain || directDomain.endsWith(`.${officialDomain}`)
  )) || aliasPublishedOnOfficialSite;
  const directPublished = Boolean(
    direct?.source_url && !sourceLooksLikeRegistry(direct.source_url) &&
      (direct.metadata.email_extraction_method ||
        direct.metadata.email_classification ||
        direct.metadata.public_contact_verified === true),
  );
  const patternEvidence = directContacts
    .filter((contact): contact is LeadgenContact & { full_name: string; email: string } => Boolean(
      contact.full_name && contact.email && contact.source_url &&
      !sourceLooksLikeRegistry(contact.source_url) &&
      (contact.metadata.email_extraction_method ||
        contact.metadata.email_classification ||
        contact.metadata.public_contact_verified === true),
    ))
    .map((contact) => ({ fullName: contact.full_name, email: contact.email }));
  const fallbackContact = contactDiscovery.fallback_entry;
  const catchAll = contactDiscovery.contacts.some((contact) => contact.metadata.email_catch_all === true)
    ? "detected" as const
    : contactDiscovery.contacts.some((contact) => contact.metadata.email_catch_all === false)
      ? "not_detected" as const
      : "unknown" as const;
  const deliveryFeedback = contactDiscovery.contacts.flatMap((contact) => {
    const status = contact.metadata.delivery_feedback_status;
    return contact.email && (status === "accepted_no_hard_bounce" || status === "hard_bounce")
      ? [{ email: contact.email, status: status as "accepted_no_hard_bounce" | "hard_bounce" }]
      : [];
  });
  const resolution = await resolvePersonalLprEmail({
    person: selectedPersonName && (person?.confidence_score ?? direct?.confidence_score ?? 0) >= 70
      ? { fullName: selectedPersonName, role: selectedRole }
      : null,
    corporateDomain: officialDomain,
    publicPersonalEmail: direct?.email
      ? { email: direct.email, reliableEvidence: directPublished && direct.confidence_score >= 70, domainAccepted: domainMatch }
      : null,
    knownCorporateEmails: patternEvidence,
    generalFallback: fallbackContact?.email
      ? { email: fallbackContact.email, publiclyConfirmed: Boolean(fallbackContact.source_url) }
      : null,
    catchAll,
    deliveryFeedback,
    verifyMx,
  });
  const selected = resolution.selected;
  const mxVerified = resolution.mx === "confirmed";
  const personEvidence = person?.evidence ?? [];
  const evidence: ContactIntelligenceEvidence[] = [];
  if (selectedPersonName) evidence.push({ kind: "person", source_url: direct?.source_url ?? null, summary: `${selectedPersonName} подтверждён публичным источником.` });
  if (selectedRole) evidence.push({
    kind: "role",
    source_url: direct?.source_url ?? null,
    summary: isRoutingContact
      ? "Контакт публично указан компанией; владение бизнес-задачей не предполагается."
      : `Роль связана с зоной ответственности: ${decisionMaker.business_problem_owner}.`,
  });
  if (direct?.email) evidence.push({ kind: "email", source_url: direct.source_url, summary: directPublished ? "Email опубликован в публичном профессиональном контексте." : "Email найден, но публикация требует дополнительного подтверждения." });
  if (domainMatch) evidence.push({ kind: "domain", source_url: contactDiscovery.official_website, summary: aliasPublishedOnOfficialSite ? "Email-домен опубликован на официальном сайте как корпоративный alias." : "Email относится к подтверждённому корпоративному домену." });
  if (mxVerified) evidence.push({ kind: "verification", source_url: null, summary: "Для домена найдены MX-записи; писем при проверке не отправлялось." });
  for (const item of personEvidence.slice(0, 2)) evidence.push({ kind: "person", source_url: direct?.source_url ?? null, summary: item.slice(0, 180) });

  if (resolution.pattern.pattern) evidence.push({ kind: "pattern", source_url: contactDiscovery.official_website, summary: `Corporate pattern выведен из ${resolution.pattern.evidenceCount} опубликованных соответствий ФИО и email.` });
  if (selected?.confidence === "HIGH_CONFIDENCE") evidence.push({ kind: "verification", source_url: contactDiscovery.official_website, summary: "Персональный email соответствует подтверждённому corporate pattern; существование mailbox не объявляется VERIFIED." });

  const selectedIsDirect = Boolean(selected && direct?.email === selected.email);
  const selectedIsFallback = Boolean(selected && fallbackContact?.email === selected.email);
  const personalReady = Boolean(
    selected?.ready && selected.emailType === "PERSONAL" && selectedPersonName && selectedRole &&
    (selectedIsDirect ? (direct?.confidence_score ?? 0) >= 70 : (person?.confidence_score ?? 0) >= 70) &&
    !duplicatePerson,
  );
  const confidence = personalReady
    ? "HIGH"
    : selected?.emailType === "GENERAL"
      ? "LOW"
      : resolution.candidates.length
        ? "MEDIUM"
        : "UNRESOLVED";
  const generatedCandidates = resolution.candidates.filter(
    (candidate) => candidate.emailType === "PERSONAL" && candidate.email !== direct?.email,
  );

  return {
    business_problem: decisionMaker.expected_pain,
    target_responsibility: decisionMaker.business_problem_owner,
    target_persona: decisionMaker.primary_persona,
    alternative_personas: decisionMaker.alternative_personas.slice(0, 5),
    why_this_person: selectedPersonName
      ? isRoutingContact
        ? `${selectedPersonName} — публично подтверждённый корпоративный контакт, выбранный как маршрутизатор; роль владельца задачи не приписывается.`
        : `${selectedRole ?? "Подтверждённый сотрудник"}: ${decisionMaker.reasoning}`
      : decisionMaker.reasoning,
    person_name: selectedPersonName,
    person_role: selectedRole,
    email: selected?.email ?? null,
    email_type: selectedIsDirect
      ? isRoutingContact ? "corporate_router" : "public_personal"
      : selected?.emailType === "PERSONAL"
        ? "pattern_candidate"
        : selectedIsFallback
          ? fallbackContact?.contact_type === "generic_email" ? "generic_fallback" : "department_fallback"
          : "none",
    email_type_label: isRoutingContact && selectedIsDirect ? "DEPARTMENT" : selected?.emailType ?? null,
    email_confidence: selected?.confidence ?? null,
    verification_methods: selected?.verificationMethods ?? [],
    confidence,
    readiness: personalReady ? "contact_ready" : selected?.emailType === "GENERAL" ? "fallback_only" : resolution.candidates.length ? "manual_verification" : "unresolved",
    evidence: compactEvidence(evidence),
    inferred_pattern: resolution.pattern.pattern,
    pattern_support: resolution.pattern.evidenceCount,
    pattern_confidence: resolution.pattern.confidence,
    generated_candidates: generatedCandidates.map((candidate) => candidate.email),
    generated_candidate_details: generatedCandidates,
    catch_all: resolution.catchAll,
    smtp_verification: "not_performed",
    resolver_cache_hit: resolution.cacheHit,
    resolver_checked_at: resolution.checkedAt,
    strategies_attempted: [
      "dynamic_role_resolution",
      "adaptive_public_person_search",
      "public_person_email_search",
      "corporate_pattern_inference",
      "domain_and_mx_validation",
    ],
    stop_reason: duplicatePerson
      ? "duplicate_person"
      : resolution.stopReason,
  };
}

export function createUnresolvedContactIntelligence({
  decisionMaker,
  peopleDiscovery,
  stopReason,
}: {
  decisionMaker: DecisionMakerProfile;
  peopleDiscovery: PeopleDiscoveryResult;
  stopReason: string;
}): ContactIntelligenceResult {
  const person = choosePerson(peopleDiscovery);
  return {
    business_problem: decisionMaker.expected_pain,
    target_responsibility: decisionMaker.business_problem_owner,
    target_persona: decisionMaker.primary_persona,
    alternative_personas: decisionMaker.alternative_personas.slice(0, 5),
    why_this_person: decisionMaker.reasoning,
    person_name: person?.full_name ?? null,
    person_role: person?.role_title ?? null,
    email: null,
    email_type: "none",
    email_type_label: null,
    email_confidence: null,
    verification_methods: [],
    confidence: "UNRESOLVED",
    readiness: "unresolved",
    evidence: [],
    inferred_pattern: null,
    pattern_support: 0,
    pattern_confidence: null,
    generated_candidates: [],
    generated_candidate_details: [],
    catch_all: "unknown",
    smtp_verification: "not_performed",
    resolver_cache_hit: false,
    resolver_checked_at: null,
    strategies_attempted: ["contact_evaluation"],
    stop_reason: stopReason,
  };
}

export function attachContactIntelligence(
  result: ContactDiscoveryResult,
  intelligence: ContactIntelligenceResult,
): ContactDiscoveryResult {
  const shouldCreateResolvedPersonal = Boolean(
    intelligence.email &&
    intelligence.email_type === "pattern_candidate" &&
    intelligence.email_confidence === "HIGH_CONFIDENCE" &&
    intelligence.readiness === "contact_ready" &&
    !result.contacts.some((contact) => contact.email === intelligence.email),
  );
  const template = result.best_available_entry;
  const generatedContact: LeadgenContact | null = shouldCreateResolvedPersonal
    ? {
        ...template,
        id: `resolver-${template.id.replace(/[^a-z0-9_.:-]+/gi, "-").slice(-96)}`,
        contact_type: "work_email",
        full_name: intelligence.person_name,
        role_title: intelligence.person_role,
        department: null,
        email: intelligence.email,
        linkedin_url: null,
        telegram_url: null,
        contact_url: null,
        source_url: result.official_website,
        source_label: "Personal LPR Email Resolver",
        confidence_score: 82,
        is_primary: true,
        metadata: {
          ...template.metadata,
          entry_role: "best_outreach_entry",
          people_discovery_role: "primary",
          email_classification: "pattern_high_confidence",
          email_status: "personal_email_ready",
          email_mx_verified: true,
          email_domain_match_reason: "official_domain",
          email_validation_status: "pattern_and_mx_confirmed",
          contact_intelligence: intelligence,
        },
      }
    : null;
  const contacts = [...result.contacts, ...(generatedContact ? [generatedContact] : [])].map((contact): LeadgenContact => ({
    ...contact,
    is_primary: generatedContact ? contact.id === generatedContact.id : contact.is_primary,
    metadata: {
      ...contact.metadata,
      ...(generatedContact && contact.id === result.best_outreach_entry?.id
        ? { entry_role: "other_entry" }
        : {}),
      ...((contact.email && contact.email === intelligence.email) ||
      (!intelligence.email && contact.id === result.best_available_entry.id)
        ? { contact_intelligence: intelligence }
        : {}),
    },
  }));
  const byId = new Map(contacts.map((contact) => [contact.id, contact]));
  return {
    ...result,
    contacts,
    best_available_entry: generatedContact ?? byId.get(result.best_available_entry.id) ?? result.best_available_entry,
    best_outreach_entry: generatedContact ?? (result.best_outreach_entry ? byId.get(result.best_outreach_entry.id) ?? result.best_outreach_entry : null),
    fallback_entry: result.fallback_entry ? byId.get(result.fallback_entry.id) ?? result.fallback_entry : null,
    alternative_channels: result.alternative_channels.map((contact) => byId.get(contact.id) ?? contact),
  };
}

export function isContactReadyPerson(contact: LeadgenContact): boolean {
  const intelligence = contact.metadata.contact_intelligence;
  if (!intelligence) return false;
  return contact.contact_type === "work_email" && Boolean(contact.email && contact.full_name && contact.role_title) &&
    (intelligence.email_confidence
      ? ["VERIFIED", "HIGH_CONFIDENCE"].includes(intelligence.email_confidence)
      : intelligence.confidence === "HIGH") &&
    intelligence.readiness === "contact_ready";
}

export function isConfirmedOutreachEmail(contact: LeadgenContact): boolean {
  if (isContactReadyPerson(contact)) return true;
  if (!contact.email || (contact.contact_type !== "work_email" && contact.contact_type !== "generic_email")) {
    return false;
  }
  const status = typeof contact.metadata.email_status === "string"
    ? contact.metadata.email_status
    : "";
  return [
    "personal_email_ready",
    "work_email_ready",
    "department_email_ready",
    "company_email_ready",
  ].includes(status) &&
    contact.metadata.email_mx_verified === true &&
    typeof contact.metadata.email_domain_match_reason === "string" &&
    Boolean(contact.source_url);
}
