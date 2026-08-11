"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { EMPTY_CLIENT_PROFILE, type ClientProfile } from "@/lib/leadgen/client-profile-types";
import type { IcpFieldState, IcpImportPreview } from "@/lib/leadgen/icp-document-parser";

const fields: Array<{ key: keyof ClientProfile; label: string; placeholder?: string; area?: boolean }> = [
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

export function ClientProfileForm({ onReady }: { onReady?: (ready: boolean, profile: ClientProfile) => void }) {
  const [profile, setProfile] = useState<ClientProfile>(EMPTY_CLIENT_PROFILE);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
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
    }
    setSaving(false);
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
      setEditing(true);
      setNotice([
        "Документ загружен, текст извлечён, ICP подготовлен. Проверьте поля и нажмите «Сохранить ICP».",
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
          <Button onClick={() => { setEditing(true); setShowImport(false); }} type="button" variant="secondary">Заполнить вручную</Button>
          <Button onClick={() => { setEditing(true); setShowImport(true); }} type="button" variant="secondary">Загрузить ICP</Button>
        </div>
      </div>
      {!editing ? (
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
