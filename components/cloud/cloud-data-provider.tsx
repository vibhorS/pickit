"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/use-cloud-data";
import { getCloudRepositories } from "@/lib/repositories/cloud";
import {
  loadCloudSnapshot,
  migrateLocalDataToSupabase,
} from "@/lib/services/cloud/migration";
import { crewService } from "@/lib/services/crew/crew-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { isLegacyUserId } from "@/lib/identity/canonical-user-id";
import { cloudSyncEngine } from "@/lib/sync/cloud-sync-engine";
import { logger } from "@/lib/observability/logger";
import { useAuthStore } from "@/store/auth-store";
import { useCrewStore } from "@/store/crew-store";
import { useLocalCollectionStore } from "@/store/local-collection-store";
import { useSyncStore } from "@/store/sync-store";
import { useVoteStore } from "@/store/vote-store";
import { useCollaborationStore } from "@/store/collaboration-store";
import { useSettingsStore } from "@/store/settings-store";
import type { Collection } from "@/lib/types";
import type { CollectionMovie } from "@/lib/services/movie-service";

/**
 * Boots cloud sync, migrates local data once, hydrates Crew-scoped stores,
 * and subscribes to realtime invalidation.
 */
export function CloudDataProvider({ children }: { children: React.ReactNode }) {
  const profile = useAuthStore((state) => state.profile);
  const setSyncMeta = useAuthStore((state) => state.setCloudSyncMeta);
  const queryClient = useQueryClient();
  const bootedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    useSyncStore.getState().setRepositoryMode("cloud");
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

        await crewService.ensureCrew(profile!);
        if (cancelled) return;

        const [snapshot, crewSnapshot] = await Promise.all([
          loadCloudSnapshot(profile!.id),
          crewService.getSnapshot(profile!.id),
        ]);
        if (cancelled) return;

        mergeCloudSnapshot(profile!.id, snapshot);
        useCrewStore.getState().setSnapshot(crewSnapshot);

        if (crewSnapshot) {
          void crewService.setPresence(profile!.id, "online", crewSnapshot.crew.id);
          const memberIds = crewSnapshot.members.map((m) => m.userId);
          const presence = await getCloudRepositories().crew.listPresence(
            memberIds,
          );
          if (!cancelled) useCrewStore.getState().setPresence(presence);
        }

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
        const crewId = snapshot.crewId;
        useSyncStore.getState().setRealtimeConnected(true);

        if (crewId) {
          unsubs.push(
            repos.crew.subscribe(crewId, () => {
              useSyncStore.getState().recordRealtimeEvent("crew", crewId);
              void refreshFromCloud(profile!.id, queryClient);
            }),
          );
          unsubs.push(
            repos.lists.subscribeCrew(crewId, () => {
              useSyncStore.getState().recordRealtimeEvent("lists", crewId);
              void refreshFromCloud(profile!.id, queryClient);
              void queryClient.invalidateQueries({
                queryKey: queryKeys.lists(profile!.id),
              });
            }),
          );
        } else {
          unsubs.push(
            repos.lists.subscribe(profile!.id, () => {
              useSyncStore.getState().recordRealtimeEvent("lists", profile!.id);
              void refreshFromCloud(profile!.id, queryClient);
              void queryClient.invalidateQueries({
                queryKey: queryKeys.lists(profile!.id),
              });
            }),
          );
        }

        unsubs.push(
          repos.ratings.subscribe(profile!.id, () => {
            useSyncStore.getState().recordRealtimeEvent("ratings", profile!.id);
            void refreshFromCloud(profile!.id, queryClient);
            void queryClient.invalidateQueries({
              queryKey: queryKeys.ratings(profile!.id),
            });
          }),
        );
        unsubs.push(
          repos.recommendations.subscribe(profile!.id, () => {
            useSyncStore.getState().recordRealtimeEvent("recommendations", profile!.id);
            void refreshFromCloud(profile!.id, queryClient);
            void queryClient.invalidateQueries({
              queryKey: queryKeys.recommendations(profile!.id),
            });
          }),
        );

        useSyncStore.getState().recordEvent({
          type: "snapshot_applied",
          entity: "boot",
          entityId: profile!.id,
          detail: `${snapshot.lists.length} lists, ${Object.values(snapshot.byCollection).flat().length} recs`,
        });

        logger.info("Cloud data hydrated", {
          userId: profile!.id,
          crewId: crewId ?? undefined,
        });
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
      useSyncStore.getState().setRealtimeConnected(false);
      for (const unsub of unsubs) unsub();
      if (profile) {
        void crewService.setPresence(profile.id, "offline");
      }
    };
  }, [profile, queryClient]);

  return <>{children}</>;
}

type CloudSnapshot = Awaited<ReturnType<typeof loadCloudSnapshot>>;

/**
 * Merge cloud snapshot into local state instead of replacing it.
 * Cloud wins for collections and items; local-only items (pending sync) are preserved.
 */
function mergeCloudSnapshot(userId: string, snapshot: CloudSnapshot) {
  useVoteStore.getState().mergeVotes(snapshot.votes);

  const localState = useLocalCollectionStore.getState();
  const localCollections = localState.createdCollections;
  const localByCollection = localState.byCollection;
  const localCaptures = localState.captures;

  // Merge collections: cloud is authoritative, but keep local-only collections
  // (those with pending sync queue items) until they sync.
  const cloudCollectionIds = new Set(snapshot.lists.map((c) => c.id));
  const mergedCollections: Collection[] = [...snapshot.lists];
  for (const localCollection of localCollections) {
    if (!cloudCollectionIds.has(localCollection.id)) {
      mergedCollections.push(localCollection);
    }
  }

  // Merge items per collection: cloud wins, local-only items preserved
  const mergedByCollection: Record<string, CollectionMovie[]> = {};
  const allCollectionIds = new Set([
    ...Object.keys(localByCollection),
    ...Object.keys(snapshot.byCollection),
  ]);

  for (const collectionId of allCollectionIds) {
    const cloudItems = snapshot.byCollection[collectionId] ?? [];
    const localItems = localByCollection[collectionId] ?? [];

    const byMovieId = new Map<string, CollectionMovie>();
    // Local first (so cloud overwrites)
    for (const item of localItems) {
      byMovieId.set(item.movie.id, item);
    }
    // Cloud overwrites with authoritative data
    for (const item of cloudItems) {
      const existing = byMovieId.get(item.movie.id);
      if (existing) {
        const localTime = existing.addedAt
          ? new Date(existing.addedAt).getTime()
          : 0;
        const cloudTime = item.addedAt
          ? new Date(item.addedAt).getTime()
          : 0;
        if (cloudTime >= localTime) {
          byMovieId.set(item.movie.id, item);
        } else {
          useSyncStore.getState().recordMergeConflict(
            "recommendation",
            `${collectionId}:${item.movie.id}`,
            "local newer than cloud — kept local",
          );
        }
      } else {
        byMovieId.set(item.movie.id, item);
      }
    }
    const merged = Array.from(byMovieId.values());
    if (merged.length > 0) {
      mergedByCollection[collectionId] = merged;
    }
  }

  useLocalCollectionStore.setState({
    createdCollections: mergedCollections,
    byCollection: mergedByCollection,
    captures: localCaptures,
  });

  const asUsers = snapshot.memberProfiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    email: profile.email,
    avatarUrl: profile.avatarUrl,
    color: profile.color,
  }));

  useCollaborationStore.setState((state) => {
    const byId = new Map(state.users.map((user) => [user.id, user]));
    for (const user of asUsers) {
      byId.set(user.id, { ...byId.get(user.id), ...user });
    }
    if (!byId.has(userId) && asUsers.length === 0) {
      const active = useAuthStore.getState().profile;
      if (active) {
        byId.set(active.id, {
          id: active.id,
          name: active.displayName,
          email: active.email ?? undefined,
          avatarUrl: active.avatarUrl ?? undefined,
          color: active.color,
        });
      }
    }
    return {
      users: Array.from(byId.values()).filter(
        (user) => !isLegacyUserId(user.id),
      ),
      activeUserId: userId,
      memberships: snapshot.memberships.length
        ? snapshot.memberships
        : state.memberships.filter(
            (membership) => !isLegacyUserId(membership.userId),
          ),
    };
  });

  const profile = useAuthStore.getState().profile;
  if (profile) {
    useCollaborationStore.getState().adoptCanonicalIdentity({
      userId: profile.id,
      displayName: profile.displayName,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      color: profile.color,
      partnerUserId: useAuthStore.getState().partner.partner?.id ?? null,
    });
  }
}

async function refreshFromCloud(
  userId: string,
  queryClient?: ReturnType<typeof useQueryClient>,
) {
  const [snapshot, crewSnapshot] = await Promise.all([
    loadCloudSnapshot(userId),
    crewService.getSnapshot(userId),
  ]);
  mergeCloudSnapshot(userId, snapshot);
  useCrewStore.getState().setSnapshot(crewSnapshot);
  if (crewSnapshot) {
    const presence = await getCloudRepositories().crew.listPresence(
      crewSnapshot.members.map((m) => m.userId),
    );
    useCrewStore.getState().setPresence(presence);
  }
}
