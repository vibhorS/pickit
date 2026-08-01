/**
 * Password reset helpers for Supabase Auth.
 *
 * Always pass an absolute `redirectTo` built from the *current* origin so
 * recovery emails never depend on the Supabase dashboard Site URL:
 * - localhost → http://localhost:3000/auth/reset-password
 * - Vercel Preview → https://<preview-host>/auth/reset-password
 * - Production → https://<production-host>/auth/reset-password
 *
 * Supabase still requires these patterns in Redirect URLs (allowlist), or it
 * will silently fall back to Site URL:
 * - http://localhost:3000/**
 * - https://*.vercel.app/**
 * - https://pickit-tau.vercel.app/**
 *
 * Site URL itself should be the production host (not localhost).
 */

export const PASSWORD_RESET_PATH = "/auth/reset-password";

/**
 * Resolve the public app origin for the current runtime.
 * Prefer `window.location.origin`; fall back to env for server-safe contexts.
 */
export function getAppOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  const configured =
    trimTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL) ??
    trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL);
  if (configured) return configured;

  if (process.env.VERCEL_ENV === "production") {
    const productionHost = trimTrailingSlash(
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
    );
    if (productionHost) return withHttps(productionHost);
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return withHttps(vercelUrl);

  return "";
}

/**
 * Absolute redirect for `resetPasswordForEmail({ redirectTo })`.
 * Dedicated recovery callback: /auth/reset-password
 */
export function getPasswordResetRedirectUrl(): string {
  const origin = getAppOrigin();
  if (!origin) {
    throw new Error(
      "Could not resolve app origin for password reset redirect.",
    );
  }
  return `${origin}${PASSWORD_RESET_PATH}`;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailAddress(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

function trimTrailingSlash(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/$/, "");
}

function withHttps(hostOrUrl: string): string {
  if (/^https?:\/\//i.test(hostOrUrl)) {
    return hostOrUrl.replace(/\/$/, "");
  }
  return `https://${hostOrUrl.replace(/\/$/, "")}`;
}
