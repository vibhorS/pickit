"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/use-cloud-data";
import { getCloudRepositories } from "@/lib/repositories/cloud";
import {
  loadCloudSnapshot,
  migrateLocalDataToSupabase,
} from "@/lib/services/cloud/migration";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { cloudSyncEngine } from "@/lib/sync/cloud-sync-engine";
import { logger } from "@/lib/observability/logger";
import { useAuthStore } from "@/store/auth-store";
import { useLocalCollectionStore } from "@/store/local-collection-store";
import { useVoteStore } from "@/store/vote-store";
import { useCollaborationStore } from "@/store/collaboration-store";
import { useSettingsStore } from "@/store/settings-store";

/**
 * Boots cloud sync, migrates local data once, hydrates in-memory stores,
 * and subscribes to realtime invalidation.
 * Zustand persists are treated as cache only after this runs.
 */
export function CloudDataProvider({ children }: { children: React.ReactNode }) {
  const profile = useAuthStore((state) => state.profile);
  const setSyncMeta = useAuthStore((state) => state.setCloudSyncMeta);
  const queryClient = useQueryClient();
  const bootedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    cloudSyncEngine.start();
    const unsub = cloudSyncEngine.subscribe((status, pendingOps) => {
      setSyncMeta?.(status, pendingOps);
    });
    return () => {
      unsub();
      cloudSyncEngine.stop();
    };
  }, [setSyncMeta]);

  useEffect(() => {
    if (!profile || !isSupabaseConfigured()) return;
    if (bootedFor.current === profile.id) return;
    bootedFor.current = profile.id;
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    async function boot() {
      try {
        await migrateLocalDataToSupabase(profile!.id);
        if (cancelled) return;
        const snapshot = await loadCloudSnapshot(profile!.id);
        if (cancelled) return;

        useVoteStore.getState().replaceVotes(snapshot.votes);
        useLocalCollectionStore.setState({
          createdCollections: snapshot.lists,
          byCollection: snapshot.byCollection,
          collectionOverrides: {},
        });

        // Keep collaboration activeUser in sync for legacy selectors
        useCollaborationStore.setState((state) => {
          const asUser = {
            id: profile!.id,
            name: profile!.displayName,
            email: profile!.email ?? undefined,
            avatarUrl: profile!.avatarUrl ?? undefined,
            color: profile!.color,
          };
          const users = state.users.some((user) => user.id === profile!.id)
            ? state.users.map((user) =>
                user.id === profile!.id ? { ...user, ...asUser } : user,
              )
            : [...state.users, asUser];
          return { users, activeUserId: profile!.id };
        });

        // Ensure owner memberships for loaded lists (single-user Phase 2A)
        useCollaborationStore.setState((state) => {
          const existing = new Set(
            state.memberships.map(
              (membership) =>
                `${membership.collectionId}:${membership.userId}`,
            ),
          );
          const additions = snapshot.lists
            .filter(
              (list) => !existing.has(`${list.id}:${profile!.id}`),
            )
            .map((list) => ({
              id: `membership-${list.id}-${profile!.id}`,
              collectionId: list.id,
              userId: profile!.id,
              role: "owner" as const,
              joinedAt: list.createdAt ?? new Date().toISOString(),
            }));
          return {
            memberships: [...state.memberships, ...additions],
          };
        });

        const prefs = await getCloudRepositories().preferences.get(
          profile!.id,
        );
        if (prefs) {
          useSettingsStore.setState({
            appearance: prefs.appearance,
            analyticsOptIn: prefs.analyticsOptIn,
            developerMode: prefs.developerMode,
          });
        }

        void queryClient.invalidateQueries({
          queryKey: queryKeys.lists(profile!.id),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.ratings(profile!.id),
        });

        const repos = getCloudRepositories();
        unsubs.push(
          repos.lists.subscribe(profile!.id, () => {
            void refreshFromCloud(profile!.id);
            void queryClient.invalidateQueries({
              queryKey: queryKeys.lists(profile!.id),
            });
          }),
        );
        unsubs.push(
          repos.ratings.subscribe(profile!.id, () => {
            void refreshFromCloud(profile!.id);
            void queryClient.invalidateQueries({
              queryKey: queryKeys.ratings(profile!.id),
            });
          }),
        );
        unsubs.push(
          repos.recommendations.subscribe(profile!.id, () => {
            void refreshFromCloud(profile!.id);
            void queryClient.invalidateQueries({
              queryKey: queryKeys.recommendations(profile!.id),
            });
          }),
        );

        logger.info("Cloud data hydrated", { userId: profile!.id });
      } catch (error) {
        logger.error("Cloud boot failed", {
          message: error instanceof Error ? error.message : "unknown",
        });
        bootedFor.current = null;
      }
    }

    void boot();
    return () => {
      cancelled = true;
      for (const unsub of unsubs) unsub();
    };
  }, [profile, queryClient]);

  return <>{children}</>;
}

async function refreshFromCloud(userId: string) {
  const snapshot = await loadCloudSnapshot(userId);
  useVoteStore.getState().replaceVotes(snapshot.votes);
  useLocalCollectionStore.setState({
    createdCollections: snapshot.lists,
    byCollection: snapshot.byCollection,
  });
}
