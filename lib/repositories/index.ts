import { getLocalRepositories } from "@/lib/repositories/local";
import { getCloudRepositories } from "@/lib/repositories/cloud";
import type { Repositories } from "@/lib/repositories/types";
import { getEnvConfig } from "@/lib/env";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function isCloudConfigured(): boolean {
  return getEnvConfig().isCloudConfigured;
}

/**
 * Repository factory.
 * When Supabase is configured, cloud is the canonical datastore.
 * Local repositories are only used as a development fallback.
 */
export function getRepositories(): Repositories {
  if (!isSupabaseConfigured()) {
    return getLocalRepositories();
  }
  return getLocalRepositories();
}

export type RepositoryMode = "cloud" | "local";

export function getActiveRepositoryMode(): RepositoryMode {
  return isSupabaseConfigured() ? "cloud" : "local";
}

export { getCloudRepositories };
