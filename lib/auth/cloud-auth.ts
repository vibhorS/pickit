import { AuthError, type AuthSession } from "@/lib/auth/auth-service";
import { getEnvConfig, getCloudConfigStatus } from "@/lib/env";
import { getCloudRepositories } from "@/lib/repositories/cloud";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/types";
import { logger } from "@/lib/observability/logger";

/**
 * Cloud authentication facade.
 * UI/stores call this — never Supabase directly.
 */
export const cloudAuth = {
  isConfigured(): boolean {
    return isSupabaseConfigured();
  },

  status() {
    return getCloudConfigStatus();
  },

  async restoreSession(): Promise<UserProfile | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      const repos = getCloudRepositories();
      const session = await repos.auth.getSession();
      if (!session) return null;
      return repos.auth.getProfile();
    } catch (error) {
      logger.error("Failed to restore cloud session", {
        message: error instanceof Error ? error.message : "unknown",
      });
      return null;
    }
  },

  async getSession(): Promise<AuthSession | null> {
    if (!isSupabaseConfigured()) return null;
    const session = await getCloudRepositories().auth.getSession();
    if (!session) return null;
    return {
      userId: session.userId,
      provider: "email",
      accessToken: session.accessToken,
      refreshToken: "",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      createdAt: new Date().toISOString(),
    };
  },

  async signUpWithEmail(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ profile: UserProfile; session: AuthSession }> {
    assertCloud();
    const profile = await getCloudRepositories().auth.signUpWithEmail(input);
    const session = await this.requireSession(profile);
    return { profile, session };
  },

  async signInWithEmail(input: {
    email: string;
    password: string;
  }): Promise<{ profile: UserProfile; session: AuthSession }> {
    assertCloud();
    const profile = await getCloudRepositories().auth.signInWithEmail(input);
    const session = await this.requireSession(profile);
    return { profile, session };
  },

  async continueAsGuest(displayName?: string) {
    assertCloud();
    const profile =
      await getCloudRepositories().auth.continueAsGuest(displayName);
    const session = await this.requireSession(profile);
    return { profile, session };
  },

  async signInWithGoogle() {
    assertCloud();
    await getCloudRepositories().auth.signInWithGoogle();
  },

  async signInWithApple() {
    assertCloud();
    await getCloudRepositories().auth.signInWithApple();
  },

  async resetPasswordForEmail(email: string) {
    assertCloud();
    await getCloudRepositories().auth.resetPasswordForEmail(email);
  },

  async updatePassword(password: string) {
    assertCloud();
    await getCloudRepositories().auth.updatePassword(password);
  },

  async updateProfile(
    userId: string,
    patch: Partial<
      Pick<UserProfile, "displayName" | "avatarUrl" | "color" | "email">
    >,
  ) {
    assertCloud();
    return getCloudRepositories().auth.updateProfile(userId, patch);
  },

  async logout() {
    if (!isSupabaseConfigured()) return;
    await getCloudRepositories().auth.logout();
  },

  async deleteAccount(userId: string) {
    assertCloud();
    await getCloudRepositories().auth.deleteAccount(userId);
  },

  onAuthStateChange(
    callback: (profile: UserProfile | null, event?: string) => void,
  ) {
    if (!isSupabaseConfigured()) return () => undefined;
    return getCloudRepositories().auth.onAuthStateChange(callback);
  },

  async requireSession(profile: UserProfile): Promise<AuthSession> {
    const session = await this.getSession();
    if (!session) {
      return {
        userId: profile.id,
        provider: profile.provider,
        accessToken: "",
        refreshToken: "",
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        createdAt: new Date().toISOString(),
      };
    }
    return { ...session, provider: profile.provider };
  },
};

function assertCloud(): void {
  if (!isSupabaseConfigured()) {
    const env = getEnvConfig();
    throw new AuthError(
      "PROVIDER_UNAVAILABLE",
      env.appEnv === "production"
        ? "Cloud authentication is unavailable. Please try again later."
        : "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
    );
  }
}
