import { create } from "zustand";
import {
  authenticationService,
  AuthError,
  type AuthSession,
} from "@/lib/auth/auth-service";
import { cloudAuth } from "@/lib/auth/cloud-auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  migrateLocalDataToCloudRepos,
  seedCollaborativeDemo,
} from "@/lib/services/collaboration/migration-service";
import {
  notificationService,
  presenceService,
} from "@/lib/services/collaboration/notification-service";
import { relationshipService } from "@/lib/services/collaboration/relationship-service";
import { syncEngine } from "@/lib/sync/sync-engine";
import type {
  PartnerSnapshot,
  SyncStatus,
  UserProfile,
} from "@/lib/types";
import { useCollaborationStore } from "@/store/collaboration-store";

type AuthStore = {
  hydrated: boolean;
  bootstrapping: boolean;
  profile: UserProfile | null;
  session: AuthSession | null;
  syncStatus: SyncStatus;
  pendingOps: number;
  cloudConfigured: boolean;
  partner: PartnerSnapshot;
  error: string | null;
  passwordRecoveryPending: boolean;
  bootstrap: () => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  continueAsGuest: (displayName?: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  setPasswordRecoveryPending: (pending: boolean) => void;
  updateProfile: (
    patch: Partial<
      Pick<UserProfile, "displayName" | "avatarUrl" | "color" | "email">
    >,
  ) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshPartner: () => Promise<void>;
  invitePartner: () => Promise<string>;
  acceptPartnerInvite: (token: string) => Promise<void>;
  declinePartnerInvite: (token: string) => Promise<void>;
  cancelPartnerInvite: () => Promise<void>;
  disconnectPartner: () => Promise<void>;
  seedDemo: () => Promise<void>;
  clearError: () => void;
  setCloudSyncMeta: (status: SyncStatus, pendingOps: number) => void;
};

const EMPTY_PARTNER: PartnerSnapshot = {
  state: "no-partner",
  relationship: null,
  partner: null,
  outgoingInvite: null,
};

function syncActiveUser(profile: UserProfile | null) {
  if (!profile) return;
  const partnerUserId =
    useAuthStore.getState().partner.partner?.id ?? null;
  useCollaborationStore.getState().adoptCanonicalIdentity({
    userId: profile.id,
    displayName: profile.displayName,
    email: profile.email,
    avatarUrl: profile.avatarUrl,
    color: profile.color,
    partnerUserId,
  });
}

function useCloud(): boolean {
  return isSupabaseConfigured();
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  hydrated: false,
  bootstrapping: false,
  profile: null,
  session: null,
  syncStatus: "idle",
  pendingOps: 0,
  cloudConfigured: false,
  partner: EMPTY_PARTNER,
  error: null,
  passwordRecoveryPending: false,

  setCloudSyncMeta: (syncStatus, pendingOps) => set({ syncStatus, pendingOps }),

  setPasswordRecoveryPending: (pending) =>
    set({ passwordRecoveryPending: pending }),

  bootstrap: async () => {
    if (get().bootstrapping || get().hydrated) return;
    set({ bootstrapping: true, error: null });
    try {
      const cloud = useCloud();
      set({ cloudConfigured: cloud });

      if (cloud) {
        const recoveryHint =
          typeof window !== "undefined" &&
          (window.location.hash.includes("type=recovery") ||
            window.location.search.includes("type=recovery"));
        const profile = await cloudAuth.restoreSession();
        const session = await cloudAuth.getSession();
        syncActiveUser(profile);
        if (profile) presenceService.start(profile.id);
        notificationService.start();

        cloudAuth.onAuthStateChange((nextProfile, event) => {
          if (event === "PASSWORD_RECOVERY") {
            set({ passwordRecoveryPending: true });
          }
          if (event === "SIGNED_OUT") {
            presenceService.stop();
            set({
              profile: null,
              session: null,
              partner: EMPTY_PARTNER,
              passwordRecoveryPending: false,
            });
            return;
          }
          if (nextProfile && !get().passwordRecoveryPending) {
            syncActiveUser(nextProfile);
            set({ profile: nextProfile });
          }
        });

        set({
          profile,
          session,
          partner: EMPTY_PARTNER,
          passwordRecoveryPending: recoveryHint,
          hydrated: true,
          bootstrapping: false,
        });
        return;
      }

      // Development fallback when Supabase env is missing.
      await migrateLocalDataToCloudRepos();
      const profile = await authenticationService.restoreSession();
      const session = authenticationService.getSession();
      syncActiveUser(profile);
      syncEngine.start();
      notificationService.start();
      if (profile) presenceService.start(profile.id);
      syncEngine.subscribe((syncStatus, pendingOps) => {
        set({ syncStatus, pendingOps });
      });
      const partner = profile
        ? await relationshipService.getSnapshot(profile.id)
        : EMPTY_PARTNER;
      set({
        profile,
        session,
        partner,
        hydrated: true,
        bootstrapping: false,
      });
    } catch (error) {
      set({
        hydrated: true,
        bootstrapping: false,
        error:
          error instanceof Error ? error.message : "Failed to start PickIt.",
      });
    }
  },

  signUp: async (input) => {
    set({ error: null });
    try {
      const result = useCloud()
        ? await cloudAuth.signUpWithEmail(input)
        : await authenticationService.signUpWithEmail(input);
      syncActiveUser(result.profile);
      presenceService.start(result.profile.id);
      set({
        profile: result.profile,
        session: result.session,
        partner: EMPTY_PARTNER,
      });
    } catch (error) {
      set({
        error:
          error instanceof AuthError
            ? error.message
            : "Could not create account.",
      });
      throw error;
    }
  },

  signIn: async (input) => {
    set({ error: null });
    try {
      const result = useCloud()
        ? await cloudAuth.signInWithEmail(input)
        : await authenticationService.signInWithEmail(input);
      syncActiveUser(result.profile);
      presenceService.start(result.profile.id);
      set({
        profile: result.profile,
        session: result.session,
        partner: EMPTY_PARTNER,
      });
    } catch (error) {
      set({
        error:
          error instanceof AuthError ? error.message : "Could not sign in.",
      });
      throw error;
    }
  },

  signInWithGoogle: async () => {
    set({ error: null });
    try {
      if (useCloud()) await cloudAuth.signInWithGoogle();
      else await authenticationService.signInWithGoogle();
    } catch (error) {
      set({
        error:
          error instanceof AuthError
            ? error.message
            : "Google Sign-In unavailable.",
      });
      throw error;
    }
  },

  signInWithApple: async () => {
    set({ error: null });
    try {
      if (useCloud()) await cloudAuth.signInWithApple();
      else await authenticationService.signInWithApple();
    } catch (error) {
      set({
        error:
          error instanceof AuthError
            ? error.message
            : "Apple Sign-In unavailable.",
      });
      throw error;
    }
  },

  continueAsGuest: async (displayName) => {
    set({ error: null });
    try {
      const result = useCloud()
        ? await cloudAuth.continueAsGuest(displayName)
        : await authenticationService.continueAsGuest(displayName);
      syncActiveUser(result.profile);
      presenceService.start(result.profile.id);
      set({
        profile: result.profile,
        session: result.session,
        partner: EMPTY_PARTNER,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Could not start guest mode.",
      });
      throw error;
    }
  },

  requestPasswordReset: async (email) => {
    set({ error: null });
    if (!useCloud()) {
      const message =
        "Password reset requires cloud authentication. Try again when cloud sync is available.";
      set({ error: message });
      throw new AuthError("PROVIDER_UNAVAILABLE", message);
    }
    try {
      await cloudAuth.resetPasswordForEmail(email);
    } catch (error) {
      set({
        error:
          error instanceof AuthError
            ? error.message
            : "We couldn't send a reset email. Please try again.",
      });
      throw error;
    }
  },

  updatePassword: async (password) => {
    set({ error: null });
    if (!useCloud()) {
      const message = "Password reset requires cloud authentication.";
      set({ error: message });
      throw new AuthError("PROVIDER_UNAVAILABLE", message);
    }
    try {
      await cloudAuth.updatePassword(password);
      const profile = await cloudAuth.restoreSession();
      const session = await cloudAuth.getSession();
      if (profile) {
        syncActiveUser(profile);
        presenceService.start(profile.id);
      }
      set({
        profile,
        session,
        passwordRecoveryPending: false,
        partner: EMPTY_PARTNER,
        error: null,
      });
    } catch (error) {
      set({
        error:
          error instanceof AuthError
            ? error.message
            : "We couldn't update your password. Please try again.",
      });
      throw error;
    }
  },

  updateProfile: async (patch) => {
    const current = get().profile;
    if (!current) return;
    const profile = useCloud()
      ? await cloudAuth.updateProfile(current.id, patch)
      : await authenticationService.updateProfile(current.id, patch);
    syncActiveUser(profile);
    set({ profile });
  },

  logout: async () => {
    presenceService.stop();
    if (useCloud()) await cloudAuth.logout();
    else await authenticationService.logout();
    set({
      profile: null,
      session: null,
      partner: EMPTY_PARTNER,
      passwordRecoveryPending: false,
    });
  },

  deleteAccount: async () => {
    const current = get().profile;
    if (!current) return;
    presenceService.stop();
    if (useCloud()) await cloudAuth.deleteAccount(current.id);
    else await authenticationService.deleteAccount(current.id);
    set({
      profile: null,
      session: null,
      partner: EMPTY_PARTNER,
      passwordRecoveryPending: false,
    });
  },

  refreshPartner: async () => {
    if (useCloud()) {
      set({ partner: EMPTY_PARTNER });
      return;
    }
    const profile = get().profile;
    if (!profile) {
      set({ partner: EMPTY_PARTNER });
      return;
    }
    const partner = await relationshipService.getSnapshot(profile.id);
    set({ partner });
    syncActiveUser(profile);
  },

  invitePartner: async () => {
    if (useCloud()) {
      throw new Error("Partner invites arrive in a later collaboration sprint.");
    }
    const profile = get().profile;
    if (!profile) throw new Error("Sign in to invite a partner.");
    const { token } = await relationshipService.invitePartner(profile.id);
    await get().refreshPartner();
    return token;
  },

  acceptPartnerInvite: async (token) => {
    if (useCloud()) {
      throw new Error("Partner invites arrive in a later collaboration sprint.");
    }
    const profile = get().profile;
    if (!profile) throw new Error("Sign in to accept an invite.");
    await relationshipService.acceptInvite(token, profile);
    syncActiveUser(profile);
    await get().refreshPartner();
  },

  declinePartnerInvite: async (token) => {
    if (useCloud()) return;
    const profile = get().profile;
    if (!profile) return;
    await relationshipService.declineInvite(token, profile.id);
    await get().refreshPartner();
  },

  cancelPartnerInvite: async () => {
    if (useCloud()) return;
    const profile = get().profile;
    if (!profile) return;
    await relationshipService.cancelInvite(profile.id);
    await get().refreshPartner();
  },

  disconnectPartner: async () => {
    if (useCloud()) return;
    const profile = get().profile;
    if (!profile) return;
    await relationshipService.disconnect(profile.id);
    await get().refreshPartner();
  },

  seedDemo: async () => {
    await seedCollaborativeDemo();
    await get().refreshPartner();
  },

  clearError: () => set({ error: null }),
}));
