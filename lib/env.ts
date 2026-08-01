/**
 * Environment validation for PickIt cloud foundation.
 * Missing required vars fail loudly in production; warn in development.
 *
 * IMPORTANT: NEXT_PUBLIC_* values must be read via static `process.env.NAME`
 * access. Next.js only inlines those into the client bundle when the key is
 * a string literal — dynamic `process.env[name]` is always undefined in the
 * browser and would incorrectly report cloud as unconfigured.
 */

export type AppEnv = "development" | "production" | "test";

export type EnvConfig = {
  appEnv: AppEnv;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  siteUrl: string | null;
  tmdbApiKey: string | null;
  openaiApiKey: string | null;
  aiProvider: string;
  isCloudConfigured: boolean;
  isAIConfigured: boolean;
};

function trimOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getEnvConfig(): EnvConfig {
  const appEnv = (trimOrNull(process.env.NEXT_PUBLIC_APP_ENV) ??
    process.env.NODE_ENV ??
    "development") as AppEnv;

  // Static property access — required for Next.js client inlining.
  const supabaseUrl = trimOrNull(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = trimOrNull(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const siteUrl =
    trimOrNull(process.env.NEXT_PUBLIC_SITE_URL) ??
    trimOrNull(process.env.NEXT_PUBLIC_APP_URL);
  const tmdbApiKey = trimOrNull(process.env.TMDB_API_KEY);
  // Server-only — never NEXT_PUBLIC_
  const openaiApiKey = trimOrNull(process.env.OPENAI_API_KEY);
  const aiProvider = trimOrNull(process.env.AI_PROVIDER) ?? "openai";
  const isCloudConfigured = Boolean(supabaseUrl && supabaseAnonKey);
  const isAIConfigured = Boolean(openaiApiKey);

  return {
    appEnv,
    supabaseUrl,
    supabaseAnonKey,
    siteUrl,
    tmdbApiKey,
    openaiApiKey,
    aiProvider,
    isCloudConfigured,
    isAIConfigured,
  };
}

export function assertCloudConfigured(): {
  url: string;
  anonKey: string;
} {
  const env = getEnvConfig();
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return { url: env.supabaseUrl, anonKey: env.supabaseAnonKey };
}

export function getCloudConfigStatus(): {
  configured: boolean;
  message: string;
} {
  const env = getEnvConfig();
  if (env.isCloudConfigured) {
    return { configured: true, message: "Cloud connected" };
  }
  return {
    configured: false,
    message:
      "Cloud database is not configured. Add Supabase credentials to .env.local to enable accounts and sync.",
  };
}
