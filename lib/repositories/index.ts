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
 * When Supabase is configured, cloud repositories are the canonical datastore.
 * Local repositories remain only as a development fallback / offline helpers.
 */
export function getRepositories(): Repositories {
  if (isSupabaseConfigured()) {
    // Legacy Repositories interface is still used by older services.
    // New cloud code should import getCloudRepositories() directly.
    return getLocalRepositories();
  }
  return getLocalRepositories();
}

export { getCloudRepositories };
