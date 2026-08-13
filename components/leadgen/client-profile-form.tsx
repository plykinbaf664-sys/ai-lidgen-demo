"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { EMPTY_CLIENT_PROFILE, type ClientProfile } from "@/lib/leadgen/client-profile-types";
import type { IcpFieldState, IcpImportPreview } from "@/lib/leadgen/icp-document-parser";

type EditableProfileKey = Exclude<keyof ClientProfile, "intelligence">;

const fields: Array<{ key: EditableProfileKey; label: string; placeholder?: string; area?: boolean }> = [
  { key: "projectName", label: "Название клиента / проекта" },
  { key: "productName", label: "Что продаём" },
  { key: "productDescription", label: "Краткое описание продукта", area: true },
  { key: "primaryValue", label: "Основная ценность", area: true },
  { key: "targetCustomer", label: "Кого ищем", area: true },
  { key: "industry", label: "Сегмент / отрасль" },
  { key: "geography", label: "География" },
  { key: "companyType", label: "Тип компании" },
  { key: "companySize", label: "Размер компании / ограничения" },
  { key: "targetProblems", label: "Основные проблемы ЦА", area: true },
  { key: "solvedProcesses", label: "Какие процессы и задачи решает продукт", area: true },
  { key: "desiredRoles", label: "Желаемые ЛПР", placeholder: "По одному или через запятую", area: true },
  { key: "exclusions", label: "Кого исключать", area: true },
  { key: "offerContext", label: "Контекст оффера", area: true },
  { key: "additionalContext", label: "Дополнительный контекст", area: true },
];

const stateLabels: Record<IcpFieldState, string> = {
  auto: "Определено автоматически",
  clarify: "Требует уточнения",
  missing: "Не найдено в документе",
};

function PreviewList({ items, empty = "Не найдено в документе" }: { items: string[]; empty?: string }) {
  return items.length ? <ul>{items.slice(0, 8).map((item) => <li key={item}>{item}</li>)}</ul> : <p className="muted">{empty}</p>;
}

function IntelligencePreview({
  preview,
  saving,
  onEdit,
  onSave,
}: {
  preview: IcpImportPreview;
  saving: boolean;
  onEdit: () => void;
  onSave: () => void;
}) {
  const intelligence = preview.intelligence;
  const mandatory = intelligence.mandatoryCriteria.value ?? intelligence.qualificationRules.filter((rule) => rule.type === "mandatory").map((rule) => rule.criterion);
  const exclusions = intelligence.exclusionCriteria.value ?? intelligence.qualificationRules.filter((rule) => rule.type === "exclusion").map((rule) => rule.criterion);
  const personas = intelligence.personaRules.length
    ? intelligence.personaRules.map((rule) => `${rule.companyContext}: ${rule.targetPersonas.join(", ")}`)
    : intelligence.targetPersonas.value ?? [];
  const offer = [...(intelligence.offerAngles.value ?? []), intelligence.cta.value].filter((item): item is string => Boolean(item));
  return (
    <div className="icp-intelligence-preview">
      <div className="icp-preview-hero">
        <div>
          <p className="eyebrow">Документ проанализирован</p>
          <h3>{intelligence.product.value || "Продукт требует уточнения"}</h3>
          <p>{intelligence.valueProposition.value || intelligence.productDescription.value || "Проверьте извлечённое описание продукта."}</p>
        </div>
        <span className={`icp-quality ${preview.quality.passed ? "passed" : "needs-review"}`}>
          {preview.quality.passed ? "Готово к проверке" : "Нужно уточнение"} · {preview.quality.score}/6
        </span>
      </div>

      <div className="icp-preview-grid">
        <article><span>Кого ищем</span><strong>{preview.profile.targetCustomer || "Не определено"}</strong></article>
        <article><span>Найдено аватаров</span><strong>{intelligence.avatars.length}</strong></article>
        <article className="wide"><span>Обязательные критерии</span><PreviewList items={mandatory} /></article>
        <article className="wide"><span>Ключевые сигналы</span><PreviewList items={intelligence.signals.map((signal) => signal.description)} /></article>
        <article className="wide"><span>ЛПР и логика выбора</span><PreviewList items={personas} /></article>
        <article className="wide"><span>Оффер и CTA</span><PreviewList items={offer} /></article>
        <article className="wide"><span>Исключения</span><PreviewList items={exclusions} /></article>
      </div>

      <details className="icp-preview-details">
        <summary>Посмотреть подробно</summary>
        <div className="icp-avatar-grid">
          {intelligence.avatars.map((avatar) => (
            <article key={avatar.name}>
              <div><strong>{avatar.name}</strong>{avatar.priority ? <span>{avatar.priority}</span> : null}</div>
              <p>{avatar.companyTypes.join(", ") || "Типы компаний не определены"}</p>
              {avatar.qualifyingSignals.length ? <small>Сигналы: {avatar.qualifyingSignals.join("; ")}</small> : null}
              {avatar.targetPersonas.length ? <small>ЛПР: {avatar.targetPersonas.join(", ")}</small> : null}
              {avatar.communicationAngle ? <small>Угол: {avatar.communicationAngle}</small> : null}
              {avatar.sourceExcerpt ? <blockquote>{avatar.sourceExcerpt}</blockquote> : null}
            </article>
          ))}
        </div>
        {intelligence.scoringRules.length ? (
          <div className="icp-rule-block"><strong>Скоринг</strong><PreviewList items={intelligence.scoringRules.map((rule) => `${rule.criterion}${rule.score === null ? "" : `: ${rule.score > 0 ? "+" : ""}${rule.score}`}${rule.condition ? ` — ${rule.condition}` : ""}`)} /></div>
        ) : null}
        {intelligence.restrictions.value?.length ? <div className="icp-rule-block"><strong>Ограничения и обещания</strong><PreviewList items={intelligence.restrictions.value} /></div> : null}
      </details>

      {preview.quality.warnings.length ? <p className="icp-preview-warning">{preview.quality.warnings.join(" ")}</p> : null}
      <div className="profile-actions icp-preview-actions">
        <Button onClick={onEdit} type="button" variant="secondary">Редактировать</Button>
        <Button disabled={!preview.quality.passed} loading={saving} onClick={onSave} type="button" variant="primary">Сохранить ICP</Button>
      </div>
    </div>
  );
}

export function ClientProfileForm({ onReady }: { onReady?: (ready: boolean, profile: ClientProfile) => void }) {
  const [profile, setProfile] = useState<ClientProfile>(EMPTY_CLIENT_PROFILE);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importPreview, setImportPreview] = useState<IcpImportPreview | null>(null);
  const [fieldStates, setFieldStates] = useState<IcpImportPreview["fieldStates"]>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/leadgen/client-profile")
      .then((response) => response.json())
      .then((data: { profile?: ClientProfile }) => {
        const next = data.profile ?? EMPTY_CLIENT_PROFILE;
        setProfile(next);
        const ready = Boolean(next.projectName && next.productName && next.targetCustomer);
        setEditing(!ready);
        onReady?.(ready, next);
      })
      .catch(() => setNotice("Не удалось загрузить ICP."))
      .finally(() => setLoading(false));
  }, [onReady]);

  async function persistProfile() {
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/leadgen/client-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = (await response.json()) as { success: boolean; profile?: ClientProfile; error?: string };
      if (!response.ok || !data.success || !data.profile) {
        setNotice(data.error || "Не удалось сохранить ICP.");
      } else {
        setProfile(data.profile);
        setEditing(false);
        setNotice("ICP сохранён. Новые кампании получат эту версию.");
        onReady?.(true, data.profile);
        setImportPreview(null);
      }
    } catch {
      setNotice("Не удалось сохранить ICP.");
    } finally {
      setSaving(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistProfile();
  }

  async function importDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) {
      setNotice("Выберите PDF, DOCX или TXT.");
      return;
    }
    setImporting(true);
    setNotice("");
    try {
      const response = await fetch("/api/leadgen/client-profile/import", { method: "POST", body: form });
      const data = (await response.json()) as { success?: boolean; preview?: IcpImportPreview; error?: string };
      if (!response.ok || !data.success || !data.preview) {
        setNotice(data.error || "Не удалось обработать документ.");
        return;
      }
      setProfile(data.preview.profile);
      setFieldStates(data.preview.fieldStates);
      setShowImport(false);
      setEditing(false);
      setImportPreview(data.preview);
      setNotice([
        "Текст извлечён один раз и преобразован в рабочую ICP-конфигурацию. Исходный файл не сохранён.",
        ...data.preview.warnings,
      ].join(" "));
    } finally {
      setImporting(false);
    }
  }

  if (loading) return <section className="panel client-profile-panel"><p>Загружаем ICP…</p></section>;

  return (
    <section className="panel client-profile-panel" id="icp">
      <div className="section-heading compact">
        <div><p className="eyebrow">1. ICP</p><h2>ICP клиента</h2></div>
        <div className="profile-actions">
          <Button onClick={() => { setImportPreview(null); setEditing(true); setShowImport(false); }} type="button" variant="secondary">Заполнить вручную</Button>
          <Button onClick={() => { setImportPreview(null); setEditing(true); setShowImport(true); }} type="button" variant="secondary">Загрузить ICP</Button>
        </div>
      </div>
      {importPreview ? (
        <IntelligencePreview
          onEdit={() => { setImportPreview(null); setEditing(true); }}
          onSave={() => { void persistProfile(); }}
          preview={importPreview}
          saving={saving}
        />
      ) : !editing ? (
        <div className="client-profile-summary">
          <div><span>Проект</span><strong>{profile.projectName}</strong></div>
          <div><span>Продукт</span><strong>{profile.productName}</strong></div>
          <div><span>Кого ищем</span><strong>{profile.targetCustomer}</strong></div>
          <div><span>Ценность</span><strong>{profile.primaryValue || "—"}</strong></div>
        </div>
      ) : showImport ? (
        <form className="icp-upload" onSubmit={importDocument}>
          <label className="form-field">
            <span>Документ ICP: PDF, DOCX или TXT</span>
            <input accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" name="file" required type="file" />
          </label>
          <p className="muted">Максимум 2 МБ. Исходный файл не сохраняется. При настроенном OpenAI текст документа отправляется в API для структурирования.</p>
          <div className="profile-actions">
            <Button loading={importing} type="submit" variant="primary">Извлечь ICP</Button>
            <Button disabled={importing} onClick={() => setShowImport(false)} type="button" variant="secondary">Назад к форме</Button>
          </div>
        </form>
      ) : (
        <form className="client-profile-form" onSubmit={save}>
          {fields.map((field) => (
            <label className="form-field" key={field.key}>
              <span>{field.label}{fieldStates[field.key] ? <small className={`icp-field-state ${fieldStates[field.key]}`}>{stateLabels[fieldStates[field.key]!]}</small> : null}</span>
              {field.area ? (
                <textarea
                  value={profile[field.key]}
                  placeholder={field.placeholder}
                  onChange={(event) => { setProfile((current) => ({ ...current, [field.key]: event.target.value })); setFieldStates((current) => ({ ...current, [field.key]: "clarify" })); }}
                />
              ) : (
                <input
                  value={profile[field.key]}
                  placeholder={field.placeholder}
                  onChange={(event) => { setProfile((current) => ({ ...current, [field.key]: event.target.value })); setFieldStates((current) => ({ ...current, [field.key]: "clarify" })); }}
                />
              )}
            </label>
          ))}
          <div className="profile-actions">
            <Button loading={saving} type="submit" variant="primary">Сохранить ICP</Button>
            {profile.updatedAt ? <Button disabled={saving} onClick={() => setEditing(false)} type="button" variant="secondary">Отмена</Button> : null}
          </div>
        </form>
      )}
      {notice ? <p className="muted" role="status">{notice}</p> : null}
    </section>
  );
}
