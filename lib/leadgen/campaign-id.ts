import { randomUUID } from "node:crypto";

export function createCampaignId(): string {
  return `campaign-${randomUUID()}`;
}

export function createPipelineRunId(): string {
  return `pipeline-run-${randomUUID()}`;
}
