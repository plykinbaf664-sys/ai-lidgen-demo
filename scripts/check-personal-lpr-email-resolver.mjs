import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  clearPersonalLprEmailResolverCache,
  resolvePersonalLprEmail,
} from "../lib/leadgen/personal-lpr-email-resolver.ts";

clearPersonalLprEmailResolverCache();
const verified = await resolvePersonalLprEmail({
  person: { fullName: "Alexey Speshilov", role: "Product Director" },
  corporateDomain: "verified-example.ru",
  publicPersonalEmail: {
    email: "alexey.speshilov@verified-example.ru",
    reliableEvidence: true,
    domainAccepted: true,
  },
  verifyMx: async () => true,
});
assert.equal(verified.selected?.confidence, "VERIFIED");
assert.equal(verified.selected?.emailType, "PERSONAL");
assert.equal(verified.candidates.length, 1, "verified public email must stop generation");

const pattern = await resolvePersonalLprEmail({
  person: { fullName: "Alexey Speshilov", role: "Product Director" },
  corporateDomain: "pattern-example.ru",
  knownCorporateEmails: [
    { fullName: "Ivan Petrov", email: "ivan.petrov@pattern-example.ru" },
    { fullName: "Anna Smirnova", email: "anna.smirnova@pattern-example.ru" },
  ],
  catchAll: "detected",
  verifyMx: async () => true,
});
assert.equal(pattern.pattern.evidenceCount, 2);
assert.equal(pattern.selected?.confidence, "HIGH_CONFIDENCE");
assert.notEqual(pattern.selected?.confidence, "VERIFIED");
assert.ok(pattern.selected?.verificationMethods.includes("catch_all_not_mailbox_proof"));

const threePartName = await resolvePersonalLprEmail({
  person: { fullName: "Alexey Sergeevich Speshilov", role: "Product Director" },
  corporateDomain: "three-part-example.ru",
  knownCorporateEmails: [
    { fullName: "Ivan Petrov", email: "ivan.petrov@three-part-example.ru" },
    { fullName: "Anna Smirnova", email: "anna.smirnova@three-part-example.ru" },
  ],
  verifyMx: async () => true,
});
assert.equal(threePartName.selected?.email, "alexey.speshilov@three-part-example.ru");

const fallback = await resolvePersonalLprEmail({
  person: { fullName: "Oleg Sidorov", role: "Commercial Director" },
  corporateDomain: "fallback-example.ru",
  generalFallback: { email: "info@fallback-example.ru", publiclyConfirmed: true },
  verifyMx: async () => true,
});
assert.equal(fallback.selected?.email, "info@fallback-example.ru");
assert.equal(fallback.selected?.confidence, "GENERAL");
const guesses = fallback.candidates.filter((item) => item.emailType === "PERSONAL");
assert.ok(guesses.length <= 3);
assert.ok(guesses.every((item) => item.confidence === "INFERRED" && !item.ready));

const invalid = await resolvePersonalLprEmail({
  person: { fullName: "Peter Ivanov", role: "CEO" },
  corporateDomain: "invalid-example.ru",
  generalFallback: { email: "info@invalid-example.ru", publiclyConfirmed: true },
  verifyMx: async () => false,
});
assert.equal(invalid.selected, null);
assert.ok(invalid.candidates.every((item) => item.confidence === "INVALID"));

const hardBounce = await resolvePersonalLprEmail({
  person: { fullName: "Bounced Person", role: "CEO" },
  corporateDomain: "bounce-example.ru",
  publicPersonalEmail: {
    email: "bounced.person@bounce-example.ru",
    reliableEvidence: true,
    domainAccepted: true,
  },
  deliveryFeedback: [{ email: "bounced.person@bounce-example.ru", status: "hard_bounce" }],
  verifyMx: async () => true,
});
assert.equal(hardBounce.selected, null);
assert.equal(hardBounce.candidates[0]?.confidence, "INVALID");

const acceptedGuess = await resolvePersonalLprEmail({
  person: { fullName: "Accepted Person", role: "CEO" },
  corporateDomain: "accepted-example.ru",
  deliveryFeedback: [{ email: "accepted.person@accepted-example.ru", status: "accepted_no_hard_bounce" }],
  verifyMx: async () => true,
});
assert.equal(acceptedGuess.selected?.confidence, "HIGH_CONFIDENCE");
assert.notEqual(acceptedGuess.selected?.confidence, "VERIFIED");

const timeout = await resolvePersonalLprEmail({
  person: { fullName: "Maria Orlova", role: "CMO" },
  corporateDomain: "timeout-example.ru",
  verifyMx: async () => { throw new Error("timeout"); },
});
assert.equal(timeout.mx, "unknown");
assert.equal(timeout.selected, null);

clearPersonalLprEmailResolverCache();
let mxCalls = 0;
const cachedInput = {
  person: { fullName: "Cache Person", role: "CEO" },
  corporateDomain: "cache-example.ru",
  verifyMx: async () => { mxCalls += 1; return true; },
};
assert.equal((await resolvePersonalLprEmail(cachedInput)).cacheHit, false);
assert.equal((await resolvePersonalLprEmail(cachedInput)).cacheHit, true);
assert.equal(mxCalls, 1);

const providerSource = await fs.readFile("lib/leadgen/public-contact-provider.ts", "utf8");
assert.match(providerSource, /Promise\.allSettled\([\s\S]*?result\.status === "fulfilled" \? result\.value : \[\]/);
const yandexSource = await fs.readFile("lib/leadgen/search/yandex-provider.ts", "utf8");
assert.match(yandexSource, /retry-after/i);
assert.match(yandexSource, /Math\.min\([\s\S]*5_000/);
const smtpSource = await fs.readFile("lib/leadgen/smtp-client.ts", "utf8");
assert.doesNotMatch(smtpSource, /resolvePersonalLprEmail|pattern_high_confidence/);

console.log("Personal LPR Email Resolver checks: OK");
