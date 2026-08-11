import "server-only";

import { createLocalSupabaseClient } from "@/lib/supabase/local-client";

export interface StorageAdapter {
  from(table: string): unknown;
  rpc(name: string, args?: Record<string, unknown>): Promise<unknown>;
}

export function createStorageAdapter(): StorageAdapter {
  return createLocalSupabaseClient() as unknown as StorageAdapter;
}

export const STORAGE_MODE = "local" as const;
