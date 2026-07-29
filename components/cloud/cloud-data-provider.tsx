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
import { bootTrace } from "@/lib/debug/boot-trace";
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
      bootTrace.beginBoot();
      bootTrace.record({
        stage: "App start / CloudDataProvider.boot() entered",
        operation: "READ",
        detail: `userId=${profile!.id}`,
        byCollection: useLocalCollectionStore.getState().byCollection,
      });

      try {
        const migrateResult = await migrateLocalDataToSupabase(profile!.id);
        if (cancelled) return;
        bootTrace.record({
          stage: "migrateLocalDataToSupabase() returned",
          operation: "MIGRATE",
          detail: JSON.stringify(migrateResult),
          byCollection: useLocalCollectionStore.getState().byCollection,
        });

        await crewService.ensureCrew(profile!);
        if (cancelled) return;
        bootTrace.record({
          stage: "crewService.ensureCrew() returned",
          operation: "READ",
          detail: null,
          byCollection: useLocalCollectionStore.getState().byCollection,
        });

        const [snapshot, crewSnapshot] = await Promise.all([
          loadCloudSnapshot(profile!.id),
          crewService.getSnapshot(profile!.id),
        ]);
        if (cancelled) return;

        bootTrace.record({
          stage: "loadCloudSnapshot() returned → pre-merge local byCollection",
          operation: "READ",
          detail: `snapshotKeys=${JSON.stringify(Object.keys(snapshot.byCollection))} localKeys=${JSON.stringify(Object.keys(useLocalCollectionStore.getState().byCollection))} skipped=${JSON.stringify(snapshot.__bootTrace?.skipped ?? [])}`,
          byCollection: useLocalCollectionStore.getState().byCollection,
        });

        bootTrace.record({
          stage: "loadCloudSnapshot() snapshot.byCollection (cloud payload)",
          operation: "SNAPSHOT",
          detail: `recsInSnapshot=${Object.values(snapshot.byCollection).flat().length}`,
          byCollection: snapshot.byCollection,
        });

        mergeCloudSnapshot(profile!.id, snapshot);
        bootTrace.record({
          stage: "mergeCloudSnapshot() / applyCloudSnapshot applied",
          operation: "MERGE",
          detail: "cloud wins; local-only movie ids preserved",
          byCollection: useLocalCollectionStore.getState().byCollection,
        });

        useCrewStore.getState().setSnapshot(crewSnapshot);
        bootTrace.record({
          stage: "after crew/setSnapshot",
          operation: "READ",
          detail: `crewId=${crewSnapshot?.crew.id ?? "null"}`,
          byCollection: useLocalCollectionStore.getState().byCollection,
        });

        if (crewSnapshot) {
          void crewService.setPresence(
            profile!.id,
            "online",
            crewSnapshot.crew.id,
          );
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

        bootTrace.record({
          stage: "after preferences + before realtime subscribe",
          operation: "READ",
          detail: null,
          byCollection: useLocalCollectionStore.getState().byCollection,
        });

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
              useSyncStore.getState().recordRealtimeEvent(
                "lists",
                profile!.id,
              );
              void refreshFromCloud(profile!.id, queryClient);
              void queryClient.invalidateQueries({
                queryKey: queryKeys.lists(profile!.id),
              });
            }),
          );
        }

        unsubs.push(
          repos.ratings.subscribe(profile!.id, () => {
            useSyncStore.getState().recordRealtimeEvent(
              "ratings",
              profile!.id,
            );
            void refreshFromCloud(profile!.id, queryClient);
            void queryClient.invalidateQueries({
              queryKey: queryKeys.ratings(profile!.id),
            });
          }),
        );
        unsubs.push(
          repos.recommendations.subscribe(profile!.id, () => {
            useSyncStore.getState().recordRealtimeEvent(
              "recommendations",
              profile!.id,
            );
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

        bootTrace.record({
          stage: "boot complete (Home-ready)",
          operation: "READ",
          detail: "end of CloudDataProvider.boot()",
          byCollection: useLocalCollectionStore.getState().byCollection,
        });

        const unsubByCollection = useLocalCollectionStore.subscribe(
          (state, prev) => {
            if (state.byCollection === prev.byCollection) return;
            bootTrace.record({
              stage: "POST-BOOT byCollection mutation",
              operation: "REPLACE",
              detail:
                "Zustand setState changed byCollection after boot complete",
              byCollection: state.byCollection,
            });
          },
        );
        unsubs.push(unsubByCollection);

        logger.info("Cloud data hydrated", {
          userId: profile!.id,
          crewId: crewId ?? undefined,
        });
      } catch (error) {
        bootTrace.record({
          stage: "Cloud boot FAILED",
          operation: "RESET",
          detail: error instanceof Error ? error.message : "unknown",
          byCollection: useLocalCollectionStore.getState().byCollection,
        });
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
  const localState = useLocalCollectionStore.getState();
  const localCollections = localState.createdCollections;
  const localByCollection = localState.byCollection;
  const localCaptures = localState.captures;

  bootTrace.record({
    stage: "mergeCloudSnapshot: BEFORE (local)",
    operation: "READ",
    detail: `localKeys=${JSON.stringify(Object.keys(localByCollection))}`,
    byCollection: localByCollection,
  });
  bootTrace.record({
    stage: "mergeCloudSnapshot: BEFORE (cloud snapshot)",
    operation: "SNAPSHOT",
    detail: `cloudKeys=${JSON.stringify(Object.keys(snapshot.byCollection))}`,
    byCollection: snapshot.byCollection,
  });

  useVoteStore.getState().mergeVotes(snapshot.votes);

  const cloudCollectionIds = new Set(snapshot.lists.map((c) => c.id));
  const mergedCollections: Collection[] = [...snapshot.lists];
  for (const localCollection of localCollections) {
    if (!cloudCollectionIds.has(localCollection.id)) {
      mergedCollections.push(localCollection);
    }
  }

  const mergedByCollection: Record<string, CollectionMovie[]> = {};
  const allCollectionIds = new Set([
    ...Object.keys(localByCollection),
    ...Object.keys(snapshot.byCollection),
  ]);

  for (const collectionId of allCollectionIds) {
    const cloudItems = snapshot.byCollection[collectionId] ?? [];
    const localItems = localByCollection[collectionId] ?? [];

    const byMovieId = new Map<string, CollectionMovie>();
    for (const item of localItems) {
      byMovieId.set(item.movie.id, item);
    }
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

  bootTrace.record({
    stage: "mergeCloudSnapshot: computed mergedByCollection (pre-setState)",
    operation: "MERGE",
    detail: "about to REPLACE store.byCollection with mergedByCollection",
    byCollection: mergedByCollection,
  });

  useLocalCollectionStore.setState({
    createdCollections: mergedCollections,
    byCollection: mergedByCollection,
    captures: localCaptures,
  });

  bootTrace.record({
    stage: "mergeCloudSnapshot: AFTER setState",
    operation: "REPLACE",
    detail: "Zustand byCollection replaced with merged result",
    byCollection: useLocalCollectionStore.getState().byCollection,
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

  bootTrace.record({
    stage: "after collaboration setState (memberships)",
    operation: "READ",
    detail: `memberships=${useCollaborationStore.getState().memberships.length}`,
    byCollection: useLocalCollectionStore.getState().byCollection,
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
    bootTrace.record({
      stage: "after adoptCanonicalIdentity",
      operation: "READ",
      detail:
        "identity remap / seed memberships — should not touch byCollection",
      byCollection: useLocalCollectionStore.getState().byCollection,
    });
  }
}

async function refreshFromCloud(
  userId: string,
  queryClient?: ReturnType<typeof useQueryClient>,
) {
  bootTrace.record({
    stage: "refreshFromCloud() ENTERED",
    operation: "SUBSCRIBE",
    detail: "realtime or invalidate triggered second hydrate",
    byCollection: useLocalCollectionStore.getState().byCollection,
  });
  const [snapshot, crewSnapshot] = await Promise.all([
    loadCloudSnapshot(userId),
    crewService.getSnapshot(userId),
  ]);
  bootTrace.record({
    stage: "refreshFromCloud: snapshot loaded",
    operation: "SNAPSHOT",
    detail: null,
    byCollection: snapshot.byCollection,
  });
  mergeCloudSnapshot(userId, snapshot);
  useCrewStore.getState().setSnapshot(crewSnapshot);
  if (crewSnapshot) {
    const presence = await getCloudRepositories().crew.listPresence(
      crewSnapshot.members.map((m) => m.userId),
    );
    useCrewStore.getState().setPresence(presence);
  }
  bootTrace.record({
    stage: "refreshFromCloud() DONE",
    operation: "MERGE",
    detail: "second apply of cloud snapshot",
    byCollection: useLocalCollectionStore.getState().byCollection,
  });
  void queryClient;
}
