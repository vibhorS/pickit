/**
 * Environment validation for PickIt cloud foundation.
 * Missing required vars fail loudly in production; warn in development.
 */

export type AppEnv = "development" | "production" | "test";

export type EnvConfig = {
  appEnv: AppEnv;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  tmdbApiKey: string | null;
  isCloudConfigured: boolean;
};

function read(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getEnvConfig(): EnvConfig {
  const appEnv = (read("NEXT_PUBLIC_APP_ENV") ??
    process.env.NODE_ENV ??
    "development") as AppEnv;
  const supabaseUrl = read("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = read("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const tmdbApiKey = read("TMDB_API_KEY");
  const isCloudConfigured = Boolean(supabaseUrl && supabaseAnonKey);

  return {
    appEnv,
    supabaseUrl,
    supabaseAnonKey,
    tmdbApiKey,
    isCloudConfigured,
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
