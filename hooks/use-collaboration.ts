"use client";

import { useAuthStore } from "@/store/auth-store";
import { useCollaborationStore } from "@/store/collaboration-store";
import type { UserProfile } from "@/lib/types";

export function useCurrentUser(): UserProfile | null {
  return useAuthStore((state) => state.profile);
}

export function useCurrentUserId(): string | null {
  return useAuthStore((state) => state.profile?.id ?? null);
}

export function usePartnerSnapshot() {
  return useAuthStore((state) => state.partner);
}

export function useSyncStatus() {
  return useAuthStore((state) => ({
    status: state.syncStatus,
    pendingOps: state.pendingOps,
  }));
}

/** Prefer auth profile; fall back to collaboration active user for legacy paths. */
export function useActiveCollaboratorId(): string {
  const authId = useAuthStore((state) => state.profile?.id);
  const collabId = useCollaborationStore((state) => state.activeUserId);
  return authId ?? collabId;
}
