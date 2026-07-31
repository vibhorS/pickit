/**
 * Password reset helpers for Supabase Auth.
 * Redirect uses the current origin so localhost, Preview, and Production
 * each receive the recovery link for that environment.
 *
 * Ensure these redirect URLs are allowlisted in Supabase → Authentication → URL Configuration:
 * - http://localhost:3000/auth/reset-password
 * - https://*.vercel.app/auth/reset-password
 * - https://pickit-tau.vercel.app/auth/reset-password
 */

export const PASSWORD_RESET_PATH = "/auth/reset-password";

export function getPasswordResetRedirectUrl(): string {
  if (typeof window === "undefined") {
    return PASSWORD_RESET_PATH;
  }
  return `${window.location.origin}${PASSWORD_RESET_PATH}`;
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
