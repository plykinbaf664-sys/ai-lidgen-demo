import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCampaignId, createPipelineRunId } from "../lib/leadgen/campaign-id.ts";
import { buildSignalQueries } from "../lib/leadgen/signals/query-builder.ts";
import { scoreIcpFit } from "../lib/leadgen/signals/icp-fit-scorer.ts";
import { getCampaignIcp } from "../lib/leadgen/verticals.ts";
import { validateCompanyQuality } from "../lib/leadgen/signals/company-quality-validator.ts";

const ids = Array.from({ length: 100 }, () => createCampaignId());
assert.equal(new Set(ids).size, ids.length, "campaign IDs must be unique");
for (const id of [...ids, createPipelineRunId()]) {
  assert.match(id, /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/);
  assert.doesNotMatch(id, /[а-яё]/i);
}

const signalTypes = [
  "HIRING_SIGNAL",
  "GO_TO_MARKET_SIGNAL",
  "GROWTH_SIGNAL",
  "CONTENT_SIGNAL",
  "TRAFFIC_SIGNAL",
  "TECH_SIGNAL",
];
const priorities = Object.fromEntries(signalTypes.map((type, index) => [type, 100 - index]));
const hints = Object.fromEntries(signalTypes.map((type) => [type, { en: ["official source"], ru: ["официальный источник"] }]));
const icp = {
  industries: { en: ["construction operator"], ru: ["строительная компания"] },
  companyTypes: { en: ["developer"], ru: ["девелопер"] },
  keywords: { en: ["inbound demand growth"], ru: ["рост входящих заявок"] },
  signalPriorities: priorities,
  signalSourceHints: hints,
};
const queries = buildSignalQueries({ icp, signalType: "HIRING_SIGNAL", market: "ru", maxQueries: 4 });
assert.ok(queries.length > 0);
assert.ok(queries.every((item) => item.query.includes("строительная компания")));
assert.ok(queries.every((item) => item.query.includes("рост входящих заявок")));
assert.ok(queries.every((item) => !item.query.includes("клиника")));

const selectedSegmentIcp = getCampaignIcp("manufacturing", {
  segmentId: "manufacturing",
  segmentLabel: "Промышленность",
  segmentDescription: "",
  industry: "Недвижимость, медицина, образование",
  targetCustomer: "Все перечисленные в исходном ICP сегменты",
  companyType: "",
  targetProblems: "",
  solvedProcesses: "",
  desiredRoles: "",
  exclusions: "",
  productName: "AI consultant",
  productDescription: "",
  primaryValue: "",
  intelligenceSummary: "",
  additionalContext: "",
});
assert.ok(selectedSegmentIcp.industries.ru.includes("производственная компания"));
assert.ok(!selectedSegmentIcp.industries.ru.includes("Недвижимость"));

const recruitingIntermediary = validateCompanyQuality({
  companyName: "Кадровый Метод",
  companyDomain: null,
  sourceDomain: "hh.ru",
  sourcePlatform: "hh.ru",
  sourceType: "job_board",
  isPlatformLikeSource: true,
  isCompanyOwnedDomain: false,
  extractionStrategy: "explicit_pattern",
  result: {
    title: "Вакансия менеджера по продажам в клинику — Кадровый Метод",
    snippet: "Работодатель: Кадровый Метод; подбор персонала для клиента.",
    source_label: "HH",
    url: "https://hh.ru/vacancy/123",
    raw_content: null,
  },
});
assert.equal(recruitingIntermediary.is_valid, false);
assert.equal(recruitingIntermediary.invalid_reason, "non_buyer_service_provider");

const evidence = [{
  signal_title: "Компания расширяет отдел продаж",
  signal_detail: "Строительная компания открыла вакансии менеджеров по продажам из-за роста входящих заявок.",
  signal_source_label: "company careers",
  source_url: "https://builder.example/careers",
  company_extraction: { company_name: "Builder", company_domain: "builder.example" },
  matched_icp_terms: ["строительная компания", "рост входящих заявок"],
  matched_signal_phrases: ["открыла вакансии"],
  matched_source_hints: ["карьерная страница"],
}];
const fit = scoreIcpFit(evidence, {
  businessTerms: ["строительная компания"],
  commercialTerms: ["рост входящих заявок"],
  painTerms: ["входящие заявки"],
  exclusionTerms: ["рекрутинговое агентство"],
});
assert.ok(fit.icp_fit_score >= 45, `adaptive ICP fit must reach the opportunity gate, got ${fit.icp_fit_score}`);
const excludedFit = scoreIcpFit([{ ...evidence[0], signal_detail: `${evidence[0].signal_detail} Рекрутинговое агентство.` }], {
  businessTerms: ["строительная компания"],
  commercialTerms: ["рост входящих заявок"],
  painTerms: ["входящие заявки"],
  exclusionTerms: ["рекрутинговое агентство"],
});
const jobBoardFit = scoreIcpFit([{
  ...evidence[0],
  source_url: "https://hh.ru/vacancy/123",
  signal_source_label: "job board",
}], {
  businessTerms: fit.breakdown.matched_business_terms,
  commercialTerms: fit.breakdown.matched_commercial_terms,
  painTerms: fit.breakdown.matched_pain_terms,
  exclusionTerms: [],
});
assert.equal(jobBoardFit.breakdown.exclusion_risk, fit.breakdown.exclusion_risk);
assert.ok(excludedFit.icp_fit_score < fit.icp_fit_score);

const [engine, dashboard, selector] = await Promise.all([
  readFile(new URL("../lib/leadgen/lead-discovery-engine.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/leadgen/leadgen-dashboard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/leadgen/email-target-selector.ts", import.meta.url), "utf8"),
]);
assert.match(engine, /id: campaignId \?\? createCampaignId\(\)/);
assert.match(engine, /const pipelineRunId = createPipelineRunId\(\)/);
assert.match(dashboard, /runLockRef\.current/);
assert.match(dashboard, /setResearchState\(completedTarget \? "ready" : "partial"\)/);
assert.doesNotMatch(dashboard, /Промежуточные\s+карточки появятся после/);
assert.match(selector, /company\.icp_fit_score < 45/);
assert.match(selector, /item\.quality_class !== "weak_hypothesis"/);
assert.match(selector, /!lead\.message\.trim\(\)/);

console.log("RESEARCH_LIFECYCLE_CHECK_OK");
