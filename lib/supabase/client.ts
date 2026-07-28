import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertCloudConfigured, getEnvConfig } from "@/lib/env";

export type PickItSupabase = SupabaseClient;

let browserClient: PickItSupabase | null = null;

export function isSupabaseConfigured(): boolean {
  return getEnvConfig().isCloudConfigured;
}

export function getSupabaseBrowserClient(): PickItSupabase {
  if (browserClient) return browserClient;
  const { url, anonKey } = assertCloudConfigured();
  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}

/** Server / script client (anon key). Prefer service role only in trusted scripts. */
export function createSupabaseServerClient(
  accessToken?: string,
): PickItSupabase {
  const { url, anonKey } = assertCloudConfigured();
  return createClient(url, anonKey, {
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createSupabaseServiceClient(): PickItSupabase {
  const { url } = assertCloudConfigured();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for admin/seed scripts.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
