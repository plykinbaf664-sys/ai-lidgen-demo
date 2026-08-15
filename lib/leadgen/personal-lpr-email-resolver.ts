export type LprEmailConfidence =
  | "VERIFIED"
  | "HIGH_CONFIDENCE"
  | "INFERRED"
  | "GENERAL"
  | "INVALID";

export type LprEmailType = "PERSONAL" | "DEPARTMENT" | "GENERAL";
export type MxVerification = boolean | "unknown";

export type LprEmailCandidate = {
  email: string;
  emailType: LprEmailType;
  confidence: LprEmailConfidence;
  ready: boolean;
  verificationMethods: string[];
};

export type LprEmailResolution = {
  selected: LprEmailCandidate | null;
  candidates: LprEmailCandidate[];
  pattern: {
    pattern: string | null;
    evidenceCount: number;
    confidence: "HIGH_CONFIDENCE" | "INFERRED" | null;
  };
  mx: "confirmed" | "missing" | "unknown";
  catchAll: "unknown" | "detected" | "not_detected";
  cacheHit: boolean;
  checkedAt: string;
  stopReason: string;
};

type PatternEvidence = { fullName: string; email: string };

type ResolverInput = {
  person: { fullName: string; role: string | null } | null;
  corporateDomain: string | null;
  publicPersonalEmail?: {
    email: string;
    reliableEvidence: boolean;
    domainAccepted: boolean;
  } | null;
  knownCorporateEmails?: PatternEvidence[];
  generalFallback?: { email: string; publiclyConfirmed: boolean } | null;
  catchAll?: "unknown" | "detected" | "not_detected";
  deliveryFeedback?: Array<{
    email: string;
    status: "accepted_no_hard_bounce" | "hard_bounce";
    checkedAt?: string;
  }>;
  verifyMx: (domain: string | null) => Promise<MxVerification>;
  maxCandidates?: number;
  cacheTtlMs?: number;
};

const CACHE_LIMIT = 500;
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const resolutionCache = new Map<string, { expiresAt: number; value: LprEmailResolution }>();

const transliteration: Record<string, string> = {
  "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
  "з": "z", "и": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
  "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts",
  "ч": "ch", "ш": "sh", "щ": "shch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function transliteratePersonPart(value: string): string {
  return normalize(value)
    .split("")
    .map((character) => transliteration[character] ?? character)
    .join("")
    .replace(/[^a-z0-9]+/g, "");
}

function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(email);
}

function getEmailDomain(email: string): string | null {
  const [, domain, extra] = normalize(email).split("@");
  return domain && !extra ? domain : null;
}

function derivePattern(evidence: PatternEvidence): string | null {
  const parts = evidence.fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts.at(-1) ?? "" : "";
  const middle = parts.length > 2 ? parts.slice(1, -1).join("") : "";
  const tokens = {
    first: transliteratePersonPart(first),
    last: transliteratePersonPart(last),
    middle: transliteratePersonPart(middle),
  };
  let local = normalize(evidence.email).split("@")[0] ?? "";
  if (!local || !tokens.first || !tokens.last) return null;
  const replacements: Array<[string, string]> = [
    [tokens.first, "{first}"], [tokens.last, "{last}"], [tokens.middle, "{middle}"],
  ];
  for (const [value, token] of replacements.sort((left, right) => right[0].length - left[0].length)) {
    if (value.length >= 2) local = local.replaceAll(value, token);
  }
  local = local
    .replace(new RegExp(`(^|[._-])${tokens.first[0]}(?=[._-]|\\{last\\})`), "$1{first_initial}")
    .replace(new RegExp(`(^|[._-])${tokens.last[0]}(?=[._-]|\\{first\\})`), "$1{last_initial}");
  return local.includes("{first") || local.includes("{last") ? local : null;
}

export function inferCorporateEmailPattern(
  evidence: PatternEvidence[],
): { pattern: string | null; support: number } {
  const counts = new Map<string, number>();
  for (const item of evidence) {
    const pattern = derivePattern(item);
    if (pattern) counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  return { pattern: best?.[0] ?? null, support: best?.[1] ?? 0 };
}

export function applyCorporateEmailPattern({ pattern, fullName, domain }: {
  pattern: string;
  fullName: string;
  domain: string;
}): string | null {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts.at(-1) ?? "" : "";
  const middle = parts.length > 2 ? parts.slice(1, -1).join("") : "";
  const values = {
    first: transliteratePersonPart(first), last: transliteratePersonPart(last), middle: transliteratePersonPart(middle),
  };
  if (!values.first || !values.last) return null;
  const local = pattern
    .replaceAll("{first}", values.first).replaceAll("{last}", values.last)
    .replaceAll("{middle}", values.middle).replaceAll("{first_initial}", values.first[0])
    .replaceAll("{last_initial}", values.last[0]);
  return /^[a-z0-9][a-z0-9._-]*$/.test(local) ? `${local}@${domain}` : null;
}

function getCacheKey(input: ResolverInput): string {
  return JSON.stringify({
    person: normalize(input.person?.fullName), role: normalize(input.person?.role), domain: normalize(input.corporateDomain),
    publicEmail: normalize(input.publicPersonalEmail?.email), publicEvidence: input.publicPersonalEmail?.reliableEvidence,
    publicDomainAccepted: input.publicPersonalEmail?.domainAccepted,
    pattern: (input.knownCorporateEmails ?? []).map((item) => [normalize(item.fullName), normalize(item.email)]).sort(),
    fallback: normalize(input.generalFallback?.email), fallbackPublished: input.generalFallback?.publiclyConfirmed,
    feedback: (input.deliveryFeedback ?? []).map((item) => [normalize(item.email), item.status]).sort(),
    catchAll: input.catchAll ?? "unknown",
  });
}

function putCache(key: string, value: LprEmailResolution, ttlMs: number) {
  if (resolutionCache.size >= CACHE_LIMIT) resolutionCache.delete(resolutionCache.keys().next().value!);
  resolutionCache.set(key, { expiresAt: Date.now() + ttlMs, value });
}

export function clearPersonalLprEmailResolverCache() {
  resolutionCache.clear();
}

export async function resolvePersonalLprEmail(input: ResolverInput): Promise<LprEmailResolution> {
  const key = getCacheKey(input);
  const cached = resolutionCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cacheHit: true };
  if (cached) resolutionCache.delete(key);

  const domain = normalize(input.corporateDomain) || null;
  const catchAll = input.catchAll ?? "unknown";
  let rawMx: MxVerification = "unknown";
  try { rawMx = await input.verifyMx(domain); } catch { rawMx = "unknown"; }
  const mx: LprEmailResolution["mx"] = rawMx === true ? "confirmed" : rawMx === false ? "missing" : "unknown";
  const patternEvidence = (input.knownCorporateEmails ?? []).filter(
    (item) => isValidEmail(item.email) && getEmailDomain(item.email) === domain,
  );
  const inferredPattern = inferCorporateEmailPattern(patternEvidence);
  const pattern = {
    pattern: inferredPattern.pattern,
    evidenceCount: inferredPattern.support,
    confidence: inferredPattern.pattern
      ? inferredPattern.support >= 2 ? "HIGH_CONFIDENCE" as const : "INFERRED" as const
      : null,
  };
  const candidates: LprEmailCandidate[] = [];
  const feedbackFor = (email: string) => input.deliveryFeedback?.find(
    (item) => normalize(item.email) === normalize(email),
  )?.status ?? null;

  const direct = input.publicPersonalEmail;
  if (direct) {
    const deliveryFeedback = feedbackFor(direct.email);
    const valid = deliveryFeedback !== "hard_bounce" && isValidEmail(direct.email) && direct.domainAccepted && mx !== "missing";
    const verified = valid && direct.reliableEvidence && mx === "confirmed";
    const candidate: LprEmailCandidate = {
      email: normalize(direct.email), emailType: "PERSONAL",
      confidence: !valid ? "INVALID" : verified ? "VERIFIED" : "INFERRED",
      ready: verified,
      verificationMethods: ["syntax", "corporate_domain", ...(mx === "confirmed" ? ["mx"] : []),
        ...(direct.reliableEvidence ? ["public_evidence"] : []),
        ...(deliveryFeedback === "accepted_no_hard_bounce" ? ["accepted_no_hard_bounce"] : []),
        ...(deliveryFeedback === "hard_bounce" ? ["hard_bounce"] : []),
        ...(catchAll === "detected" ? ["catch_all_not_mailbox_proof"] : [])],
    };
    candidates.push(candidate);
    if (candidate.ready) {
      const result = { selected: candidate, candidates, pattern, mx, catchAll, cacheHit: false, checkedAt: new Date().toISOString(), stopReason: "verified_public_personal_email" };
      putCache(key, result, input.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS);
      return result;
    }
  }

  if (input.person && domain) {
    const patterns = pattern.pattern
      ? [pattern.pattern]
      : ["{first}.{last}", "{first_initial}.{last}", "{last}.{first_initial}"];
    for (const candidatePattern of patterns) {
      const email = applyCorporateEmailPattern({ pattern: candidatePattern, fullName: input.person.fullName, domain });
      const patternConfirmed = candidatePattern === pattern.pattern && pattern.evidenceCount >= 2;
      const deliveryFeedback = email ? feedbackFor(email) : null;
      const existing = email ? candidates.find((item) => item.email === email) : null;
      if (existing) {
        if (patternConfirmed && mx === "confirmed" && existing.confidence !== "INVALID") {
          existing.confidence = "HIGH_CONFIDENCE";
          existing.ready = true;
          existing.verificationMethods.push(`corporate_pattern:${pattern.evidenceCount}`);
        }
        continue;
      }
      if (!email) continue;
      const valid = deliveryFeedback !== "hard_bounce" && isValidEmail(email) && mx !== "missing";
      candidates.push({
        email, emailType: "PERSONAL",
        confidence: !valid ? "INVALID" : (patternConfirmed && mx === "confirmed") || deliveryFeedback === "accepted_no_hard_bounce" ? "HIGH_CONFIDENCE" : "INFERRED",
        ready: valid && ((patternConfirmed && mx === "confirmed") || deliveryFeedback === "accepted_no_hard_bounce"),
        verificationMethods: ["syntax", "corporate_domain", ...(mx === "confirmed" ? ["mx"] : []),
          ...(patternConfirmed ? [`corporate_pattern:${pattern.evidenceCount}`] : ["unconfirmed_pattern"]),
          ...(deliveryFeedback === "accepted_no_hard_bounce" ? ["accepted_no_hard_bounce"] : []),
          ...(deliveryFeedback === "hard_bounce" ? ["hard_bounce"] : []),
          ...(catchAll === "detected" ? ["catch_all_not_mailbox_proof"] : [])],
      });
      if (candidates.length >= Math.min(Math.max(input.maxCandidates ?? 3, 1), 3)) break;
    }
  }

  const highConfidence = candidates.find((item) => item.ready && item.confidence === "HIGH_CONFIDENCE") ?? null;
  const fallbackEmail = normalize(input.generalFallback?.email);
  const fallbackFeedback = feedbackFor(fallbackEmail);
  const fallbackValid = Boolean(
    fallbackEmail && fallbackFeedback !== "hard_bounce" && input.generalFallback?.publiclyConfirmed && isValidEmail(fallbackEmail) &&
    getEmailDomain(fallbackEmail) === domain && mx === "confirmed",
  );
  const fallback: LprEmailCandidate | null = fallbackEmail
    ? { email: fallbackEmail, emailType: "GENERAL", confidence: fallbackValid ? "GENERAL" : "INVALID", ready: fallbackValid,
        verificationMethods: ["syntax", "corporate_domain", ...(mx === "confirmed" ? ["mx"] : []),
          ...(input.generalFallback?.publiclyConfirmed ? ["public_evidence"] : []),
          ...(fallbackFeedback === "accepted_no_hard_bounce" ? ["accepted_no_hard_bounce"] : []),
          ...(fallbackFeedback === "hard_bounce" ? ["hard_bounce"] : [])] }
    : null;
  const selected = highConfidence ?? (fallback?.ready ? fallback : null);
  const result: LprEmailResolution = {
    selected, candidates: fallback ? [...candidates, fallback] : candidates, pattern, mx, catchAll, cacheHit: false,
    checkedAt: new Date().toISOString(),
    stopReason: highConfidence ? "high_confidence_pattern_personal_email" : fallback?.ready ? "general_corporate_fallback" : candidates.length ? "personal_candidates_not_ready" : "email_unresolved",
  };
  putCache(key, result, input.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS);
  return result;
}
