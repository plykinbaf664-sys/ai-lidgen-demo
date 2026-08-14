import { leadgenConfig } from "./config.ts";
import { splitProfileTerms, type ClientProfileSnapshot } from "./client-profile-types.ts";

export type LeadgenVerticalId =
  | "real_estate" | "manufacturing" | "medicine" | "dentistry"
  | "legal" | "insurance" | "it" | "marketing_agencies"
  | "logistics" | "education" | "construction";

export type LeadgenVerticalProfile = {
  id: LeadgenVerticalId;
  label: string;
  sources: string[];
  industries: string[];
  companyTypes: string[];
  signalTerms: string[];
  targetRoles: string[];
  emailPriority: Array<"personal" | "sales" | "commercial" | "marketing" | "general">;
  offer: string;
  pains: string[];
  triggers: string[];
  examples: string[];
  vocabulary: string[];
  ctas: string[];
};

function profile(value: LeadgenVerticalProfile) { return value; }

export const LEADGEN_VERTICALS: Record<LeadgenVerticalId, LeadgenVerticalProfile> = {
  real_estate: profile({ id: "real_estate", label: "Недвижимость", sources: ["hh", "cian", "avito", "company_site"], industries: ["агентство недвижимости", "девелопер", "управляющая компания"], companyTypes: ["агентство", "девелопер", "сеть офисов продаж"], signalTerms: ["набор агентов", "новый жилой комплекс", "открытие офиса", "рост объектов"], targetRoles: ["Коммерческий директор", "Руководитель отдела продаж", "Директор"], emailPriority: ["personal", "sales", "commercial", "general"], offer: "ускоряем квалификацию покупателей и передачу тёплых обращений менеджерам", pains: ["потеря входящих лидов", "ручная квалификация", "медленный первый ответ"], triggers: ["рост объектов", "набор отдела продаж", "новый проект"], examples: ["квалификация покупателя", "подбор объекта", "повторное касание"], vocabulary: ["объект", "покупатель", "отдел продаж"], ctas: ["Показать схему на вашем входящем потоке?"] }),
  manufacturing: profile({ id: "manufacturing", label: "Производственные компании", sources: ["hh", "industry_catalogs", "company_site"], industries: ["производственная компания", "завод", "производитель", "дистрибьютор"], companyTypes: ["производитель", "завод", "промышленная группа"], signalTerms: ["новая продукция", "экспорт", "представительство", "расширение продаж"], targetRoles: ["Директор по развитию", "Руководитель отдела продаж", "Генеральный директор"], emailPriority: ["personal", "commercial", "sales", "general"], offer: "ускоряем разбор входящих запросов, дилерских заявок и подготовку первого ответа", pains: ["долгий разбор ТЗ", "ручная маршрутизация", "задержка коммерческого ответа"], triggers: ["новая продукция", "экспорт", "расширение дилерской сети"], examples: ["разбор запроса", "сбор данных для КП", "маршрутизация дилера"], vocabulary: ["заявка", "дилер", "коммерческое предложение"], ctas: ["Показать, какой участок я бы автоматизировал первым?"] }),
  medicine: profile({ id: "medicine", label: "Медицина", sources: ["hh", "clinic_sites", "medical_catalogs"], industries: ["клиника", "медицинский центр", "сеть клиник"], companyTypes: ["частная клиника", "медицинская сеть", "диагностический центр"], signalTerms: ["новый филиал", "новые услуги", "вакансии врачей", "закупка оборудования"], targetRoles: ["Исполнительный директор", "Главный врач", "Коммерческий директор"], emailPriority: ["personal", "commercial", "marketing", "general"], offer: "автоматизируем запись пациентов, повторные обращения и первичную обработку заявок", pains: ["пропущенные обращения", "нагрузка на регистратуру", "ручные напоминания"], triggers: ["новый филиал", "новая услуга", "рост записи"], examples: ["запись пациента", "подтверждение визита", "возврат пациента"], vocabulary: ["пациент", "запись", "регистратура"], ctas: ["Показать схему для вашей записи пациентов?"] }),
  dentistry: profile({ id: "dentistry", label: "Стоматологии", sources: ["hh", "clinic_sites", "medical_catalogs"], industries: ["стоматология", "стоматологическая клиника", "сеть стоматологий"], companyTypes: ["стоматология", "сеть клиник"], signalTerms: ["новый филиал", "новые врачи", "имплантация", "рост записи"], targetRoles: ["Управляющий клиникой", "Главный врач", "Коммерческий директор"], emailPriority: ["personal", "marketing", "commercial", "general"], offer: "помогаем быстрее записывать пациентов и возвращать незавершённые обращения", pains: ["неподтверждённые записи", "потерянные звонки", "невернувшиеся пациенты"], triggers: ["новый филиал", "новая услуга", "набор врачей"], examples: ["запись", "напоминание", "возврат на план лечения"], vocabulary: ["пациент", "приём", "план лечения"], ctas: ["Показать два сценария для вашей клиники?"] }),
  legal: profile({ id: "legal", label: "Юридические компании", sources: ["hh", "company_site", "legal_catalogs"], industries: ["юридическая компания", "адвокатское бюро", "юридический консалтинг"], companyTypes: ["юридическая фирма", "адвокатское бюро"], signalTerms: ["новая практика", "рост команды", "новый офис", "партнёрство"], targetRoles: ["Управляющий партнёр", "Директор по развитию", "Руководитель практики"], emailPriority: ["personal", "commercial", "marketing", "general"], offer: "ускоряем первичный разбор обращений и сбор контекста до подключения юриста", pains: ["ручной intake", "неполные вводные", "медленная маршрутизация"], triggers: ["новая практика", "рост команды", "новый офис"], examples: ["первичный intake", "сбор документов", "назначение практики"], vocabulary: ["доверитель", "практика", "запрос"], ctas: ["Показать короткую схему intake?"] }),
  insurance: profile({ id: "insurance", label: "Страхование", sources: ["hh", "company_site", "industry_news"], industries: ["страховая компания", "страховой брокер", "insurtech"], companyTypes: ["страховщик", "страховой брокер"], signalTerms: ["новый продукт", "партнёрство", "рост агентов", "цифровой канал"], targetRoles: ["Директор по развитию", "Директор клиентского сервиса", "Коммерческий директор"], emailPriority: ["personal", "commercial", "sales", "general"], offer: "ускоряем первичный разбор обращений, уточнение данных и передачу клиента специалисту", pains: ["долгая квалификация", "неполные данные", "нагрузка на контакт-центр"], triggers: ["новый продукт", "новый канал", "рост партнёров"], examples: ["квалификация запроса", "сбор данных", "маршрутизация"], vocabulary: ["страхователь", "продукт", "обращение"], ctas: ["Показать сценарий для вашего входящего потока?"] }),
  it: profile({ id: "it", label: "IT", sources: ["hh", "company_site", "product_news"], industries: ["IT-компания", "разработчик ПО", "интегратор"], companyTypes: ["разработчик", "интегратор", "IT-сервис"], signalTerms: ["новый продукт", "интеграция", "рост sales", "выход на рынок"], targetRoles: ["Директор по развитию", "Коммерческий директор", "Head of Sales"], emailPriority: ["personal", "sales", "commercial", "general"], offer: "автоматизируем квалификацию входящих запросов и сбор технического контекста до менеджера", pains: ["долгий discovery", "ручная квалификация", "неполные требования"], triggers: ["релиз", "интеграция", "рост продаж"], examples: ["discovery запроса", "квалификация", "передача sales"], vocabulary: ["интеграция", "продукт", "discovery"], ctas: ["Показать, где сократить первый этап discovery?"] }),
  marketing_agencies: profile({ id: "marketing_agencies", label: "Маркетинговые агентства", sources: ["hh", "agency_sites", "case_studies"], industries: ["маркетинговое агентство", "digital-агентство", "performance-агентство"], companyTypes: ["агентство", "digital-студия"], signalTerms: ["новые кейсы", "рост команды", "новые услуги", "новый офис"], targetRoles: ["Основатель", "Коммерческий директор", "New Business Director"], emailPriority: ["personal", "sales", "commercial", "general"], offer: "ускоряем квалификацию брифов, сбор вводных и повторные касания с потенциальными клиентами", pains: ["неполные брифы", "ручной follow-up", "долгий ответ new business"], triggers: ["новая услуга", "рост команды", "новый кейс"], examples: ["сбор брифа", "квалификация", "follow-up"], vocabulary: ["бриф", "клиент", "new business"], ctas: ["Показать схему разбора входящего брифа?"] }),
  logistics: profile({ id: "logistics", label: "Логистика", sources: ["hh", "company_site", "industry_catalogs"], industries: ["логистическая компания", "транспортная компания", "3PL"], companyTypes: ["логистический оператор", "перевозчик", "3PL"], signalTerms: ["новое направление", "новый склад", "расширение парка", "рост продаж"], targetRoles: ["Коммерческий директор", "Директор по развитию", "Руководитель продаж"], emailPriority: ["personal", "commercial", "sales", "general"], offer: "ускоряем разбор заявок на перевозку, уточнение параметров и передачу менеджеру", pains: ["неполные заявки", "ручной расчёт вводных", "долгий первый ответ"], triggers: ["новое направление", "новый склад", "рост парка"], examples: ["сбор параметров", "квалификация маршрута", "передача менеджеру"], vocabulary: ["маршрут", "груз", "заявка"], ctas: ["Показать сценарий первичного разбора заявки?"] }),
  education: profile({ id: "education", label: "Образование", sources: ["hh", "school_sites", "course_catalogs"], industries: ["образовательная компания", "онлайн-школа", "учебный центр"], companyTypes: ["онлайн-школа", "учебный центр", "образовательная сеть"], signalTerms: ["новая программа", "новый филиал", "набор кураторов", "рост продаж"], targetRoles: ["Коммерческий директор", "Директор по маркетингу", "Руководитель продаж"], emailPriority: ["personal", "sales", "marketing", "general"], offer: "автоматизируем ответы абитуриентам, квалификацию и возврат незавершённых заявок", pains: ["потеря заявок", "повторяющиеся вопросы", "ручной follow-up"], triggers: ["новая программа", "новый поток", "рост команды"], examples: ["квалификация", "ответы по программе", "возврат заявки"], vocabulary: ["абитуриент", "программа", "обучение"], ctas: ["Показать сценарий для вашей воронки набора?"] }),
  construction: profile({ id: "construction", label: "Строительство", sources: ["hh", "company_site", "tenders", "industry_news"], industries: ["строительная компания", "генподрядчик", "инжиниринговая компания"], companyTypes: ["генподрядчик", "застройщик", "инжиниринговая компания"], signalTerms: ["новый объект", "тендер", "расширение географии", "набор продаж"], targetRoles: ["Коммерческий директор", "Директор по развитию", "Генеральный директор"], emailPriority: ["personal", "commercial", "sales", "general"], offer: "ускоряем первичный разбор запросов, тендерных вводных и передачу задачи ответственному", pains: ["разрозненные запросы", "неполные вводные", "медленная маршрутизация"], triggers: ["новый объект", "тендер", "новый регион"], examples: ["разбор запроса", "сбор вводных", "назначение ответственного"], vocabulary: ["объект", "тендер", "подряд"], ctas: ["Показать, какой участок входящего процесса проверить первым?"] }),
};

export const DEFAULT_VERTICAL_ID: LeadgenVerticalId = "manufacturing";

export function isLeadgenVerticalId(value: unknown): value is LeadgenVerticalId {
  return typeof value === "string" && value in LEADGEN_VERTICALS;
}

export function getVerticalProfile(value?: string | null) {
  return LEADGEN_VERTICALS[isLeadgenVerticalId(value) ? value : DEFAULT_VERTICAL_ID];
}

export function getVerticalIcp(value?: string | null) {
  const vertical = getVerticalProfile(value);
  return {
    ...leadgenConfig.icp,
    label: `ICP: ${vertical.label}`,
    note: `${vertical.offer}. Источники: ${vertical.sources.join(", ")}.`,
    industries: { en: vertical.industries, ru: vertical.industries },
    companyTypes: { en: vertical.companyTypes, ru: vertical.companyTypes },
    keywords: { en: [...vertical.signalTerms, ...vertical.vocabulary], ru: [...vertical.signalTerms, ...vertical.vocabulary] },
  };
}

export function getCampaignVerticalProfile(
  verticalId?: string | null,
  snapshot?: ClientProfileSnapshot | null,
): LeadgenVerticalProfile {
  const vertical = getVerticalProfile(verticalId);
  if (!snapshot) return vertical;
  const customRoles = splitProfileTerms(snapshot.desiredRoles);
  const customPains = splitProfileTerms(snapshot.targetProblems);
  const customProcesses = splitProfileTerms(snapshot.solvedProcesses);
  const intelligence = snapshot.intelligence;
  const avatarCompanyTypes = intelligence?.avatars.flatMap((avatar) => avatar.companyTypes) ?? [];
  const avatarProblems = intelligence?.avatars.flatMap((avatar) => avatar.businessProblems) ?? [];
  const avatarSignals = intelligence?.avatars.flatMap((avatar) => avatar.qualifyingSignals) ?? [];
  const intelligenceSignals = intelligence?.signals.map((signal) => signal.description) ?? [];
  const intelligenceRoles = [
    ...(intelligence?.targetPersonas.value ?? []),
    ...(intelligence?.avatars.flatMap((avatar) => avatar.targetPersonas) ?? []),
    ...(intelligence?.personaRules.flatMap((rule) => rule.targetPersonas) ?? []),
  ];
  const intelligenceCompanyTypes = [
    ...(intelligence?.targetCompanies.value ?? []),
    ...avatarCompanyTypes,
  ];
  const intelligencePains = [
    ...(intelligence?.businessProblems.value ?? []),
    ...avatarProblems,
  ];
  const intelligenceCriteria = [
    ...(intelligence?.mandatoryCriteria.value ?? []),
    ...(intelligence?.preferredCriteria.value ?? []),
  ];
  const customIndustries = splitProfileTerms(
    [snapshot.segmentLabel, snapshot.segmentDescription, snapshot.industry, snapshot.targetCustomer]
      .filter(Boolean)
      .join(","),
  );
  const selectedIndustries =
    snapshot.segmentId === "other" && customIndustries.length
      ? customIndustries
      : vertical.industries;
  return {
    ...vertical,
    label: snapshot.segmentLabel || vertical.label,
    industries: selectedIndustries,
    companyTypes: [...new Set([...intelligenceCompanyTypes, ...splitProfileTerms(snapshot.companyType), ...vertical.companyTypes])].slice(0, 24),
    signalTerms: [...new Set([...intelligenceSignals, ...avatarSignals, ...intelligenceCriteria, ...customPains, ...customProcesses, ...vertical.signalTerms])].slice(0, 32),
    targetRoles: [...new Set([...intelligenceRoles, ...customRoles, ...vertical.targetRoles])].slice(0, 24),
    offer: intelligence?.offerAngles.value?.[0] || snapshot.primaryValue || snapshot.productDescription || vertical.offer,
    pains: [...new Set([...intelligencePains, ...customPains, ...vertical.pains])].slice(0, 24),
    examples: customProcesses.length ? customProcesses : vertical.examples,
    vocabulary: [...new Set([...customIndustries, ...intelligenceCompanyTypes, ...customProcesses])].slice(0, 24),
    ctas: intelligence?.cta.value ? [intelligence.cta.value, ...vertical.ctas] : vertical.ctas,
  };
}

export function getCampaignIcp(
  verticalId?: string | null,
  snapshot?: ClientProfileSnapshot | null,
) {
  const vertical = getCampaignVerticalProfile(verticalId, snapshot);
  const contextTerms = snapshot
    ? splitProfileTerms([
        snapshot.productName,
        snapshot.productDescription,
        snapshot.primaryValue,
        snapshot.targetProblems,
        snapshot.solvedProcesses,
        snapshot.intelligenceSummary,
        snapshot.additionalContext,
      ].filter(Boolean).join(","))
    : [];
  return {
    ...getVerticalIcp(verticalId),
    label: snapshot?.targetCustomer ? `ICP: ${snapshot.targetCustomer}` : `ICP: ${vertical.label}`,
    note: snapshot?.primaryValue || `${vertical.offer}. Источники: ${vertical.sources.join(", ")}.`,
    industries: { en: vertical.industries, ru: vertical.industries },
    companyTypes: { en: vertical.companyTypes, ru: vertical.companyTypes },
    keywords: {
      en: [...new Set([...vertical.signalTerms, ...vertical.vocabulary, ...contextTerms])],
      ru: [...new Set([...vertical.signalTerms, ...vertical.vocabulary, ...contextTerms])],
    },
  };
}

export function inferVerticalId(text?: string | null): LeadgenVerticalId {
  const value = (text ?? "").toLowerCase();
  for (const vertical of Object.values(LEADGEN_VERTICALS)) {
    if ([vertical.label, ...vertical.industries, ...vertical.vocabulary].some((term) => value.includes(term.toLowerCase()))) return vertical.id;
  }
  return DEFAULT_VERTICAL_ID;
}
