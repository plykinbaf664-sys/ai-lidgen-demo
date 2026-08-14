"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import type { CampaignInput } from "@/lib/leadgen/types";
import { SEGMENTS } from "@/lib/leadgen/segments";

type CampaignFormProps = {
  isRunning?: boolean;
  disabled?: boolean;
  onRun: (campaign: CampaignInput) => void | Promise<void>;
};

const defaultRequestedBy = "Клиент";
const defaultSegmentId = "manufacturing";
const defaultSegmentName = `${SEGMENTS.find((item) => item.id === defaultSegmentId)?.label ?? "Новый сегмент"} — новые лиды`;

export function CampaignForm({ isRunning = false, disabled = false, onRun }: CampaignFormProps) {
  const [segmentId, setSegmentId] = useState(defaultSegmentId);
  const [segmentDescription, setSegmentDescription] = useState("");
  const [targetCount, setTargetCount] = useState(20);
  const [name, setName] = useState(defaultSegmentName);

  function handleSegmentChange(value: string) {
    setSegmentId(value);
    const segment = SEGMENTS.find((item) => item.id === value);
    setName(`${segment?.label ?? "Новый сегмент"} — новые лиды`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const segment = SEGMENTS.find((item) => item.id === segmentId);
    void onRun({
      name: name.trim(),
      requestedBy: defaultRequestedBy,
      verticalId: segment?.verticalId ?? undefined,
      segmentId,
      segmentDescription: segmentId === "other" ? segmentDescription.trim() : undefined,
      targetCount,
    });
  }

  return (
    <form className={`campaign-form campaign-form-compact${segmentId === "other" ? " has-custom-segment" : ""}`} onSubmit={handleSubmit}>
      <label className="form-field campaign-field-segment">
        <span>Сегмент</span>
        <select disabled={isRunning || disabled} value={segmentId} onChange={(event) => handleSegmentChange(event.target.value)}>
          {SEGMENTS.map((segment) => <option key={segment.id} value={segment.id}>{segment.label}</option>)}
        </select>
      </label>
      {segmentId === "other" ? (
        <label className="form-field campaign-field-other">
          <span>Описание сегмента</span>
          <textarea disabled={isRunning || disabled} required value={segmentDescription} onChange={(event) => setSegmentDescription(event.target.value)} />
        </label>
      ) : null}
      <label className="form-field campaign-field-name">
        <span>Название кампании</span>
        <input disabled={isRunning || disabled} required value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="form-field campaign-field-target">
        <span>Количество готовых лидов</span>
        <select disabled={isRunning || disabled} value={targetCount} onChange={(event) => setTargetCount(Number(event.target.value))}>
          <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option>
        </select>
      </label>
      <p className="muted campaign-vertical-note">Цель считается по готовым лидам с сигналом, сайтом, контактом и письмом.</p>
      <Button className="campaign-submit-button" disabled={disabled || isRunning} loading={isRunning} type="submit" variant="primary">
        {isRunning ? "Идёт поиск…" : "Запустить поиск"}
      </Button>
    </form>
  );
}
