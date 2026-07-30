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

function catalogIdsFromStore(extraIds: string[] = []): string[] {
  const local = useLocalCollectionStore.getState();
  return Array.from(
    new Set([
      ...extraIds,
      ...local.createdCollections.map((c) => c.id),
      ...Object.keys(local.byCollection),
    ]),
  );
}

function collectionNamesFromStore(
  extra: Record<string, string> = {},
): Record<string, string> {
  const local = useLocalCollectionStore.getState();
  const names: Record<string, string> = { ...extra };
  for (const collection of local.createdCollections) {
    names[collection.id] = collection.name;
  }
  return names;
}

function recordByCollection(
  stage: string,
  operation: Parameters<typeof bootTrace.record>[0]["operation"],
  byCollection: Record<
    string,
    | CollectionMovie[]
    | Array<{
        movie?: { id?: string; title?: string } | null;
        recommendationId?: string | null;
      }>
  >,
  detail?: string | null,
  extraCatalogIds: string[] = [],
  extraNames: Record<string, string> = {},
) {
  bootTrace.record({
    stage,
    operation,
    detail,
    byCollection,
    catalogIds: catalogIdsFromStore(extraCatalogIds),
    collectionNames: collectionNamesFromStore(extraNames),
  });
}

const ANIMATED_ID = "collection-80bc5b34-2a3f-4fb2-8be9-036efd0e05e9";

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
      recordByCollection(
        "App start / CloudDataProvider.boot() entered",
        "READ",
        useLocalCollectionStore.getState().byCollection,
        `userId=${profile!.id}`,
      );

      try {
        const migrateResult = await migrateLocalDataToSupabase(profile!.id);
        if (cancelled) return;
        recordByCollection(
          "migrateLocalDataToSupabase() returned",
          "MIGRATE",
          useLocalCollectionStore.getState().byCollection,
          JSON.stringify(migrateResult),
        );

        await crewService.ensureCrew(profile!);
        if (cancelled) return;
        recordByCollection(
          "crewService.ensureCrew() returned",
          "READ",
          useLocalCollectionStore.getState().byCollection,
          null,
        );

        const [snapshot, crewSnapshot] = await Promise.all([
          loadCloudSnapshot(profile!.id),
          crewService.getSnapshot(profile!.id),
        ]);
        if (cancelled) return;

        const snapshotListIds = snapshot.lists.map((list) => list.id);
        const snapshotNames = Object.fromEntries(
          snapshot.lists.map((list) => [list.id, list.name]),
        );

        recordByCollection(
          "loadCloudSnapshot() returned → pre-merge local byCollection",
          "READ",
          useLocalCollectionStore.getState().byCollection,
          `snapshotKeys=${JSON.stringify(Object.keys(snapshot.byCollection))} localKeys=${JSON.stringify(Object.keys(useLocalCollectionStore.getState().byCollection))} skipped=${JSON.stringify(snapshot.__bootTrace?.skipped ?? [])}`,
          snapshotListIds,
          snapshotNames,
        );

        recordByCollection(
          "loadCloudSnapshot() snapshot.byCollection (cloud payload)",
          "SNAPSHOT",
          snapshot.byCollection,
          `recsInSnapshot=${Object.values(snapshot.byCollection).flat().length}`,
          snapshotListIds,
          snapshotNames,
        );

        mergeCloudSnapshot(profile!.id, snapshot);
        recordByCollection(
          "mergeCloudSnapshot() / applyCloudSnapshot applied",
          "MERGE",
          useLocalCollectionStore.getState().byCollection,
          "cloud wins; local-only movie ids preserved",
          snapshotListIds,
          snapshotNames,
        );

        useCrewStore.getState().setSnapshot(crewSnapshot);
        recordByCollection(
          "after crew/setSnapshot",
          "READ",
          useLocalCollectionStore.getState().byCollection,
          `crewId=${crewSnapshot?.crew.id ?? "null"}`,
          snapshotListIds,
        );

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

        recordByCollection(
          "after preferences + before realtime subscribe",
          "READ",
          useLocalCollectionStore.getState().byCollection,
          null,
          snapshotListIds,
        );

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

        recordByCollection(
          "boot complete (Home-ready)",
          "READ",
          useLocalCollectionStore.getState().byCollection,
          "end of CloudDataProvider.boot()",
          snapshotListIds,
        );

        const unsubByCollection = useLocalCollectionStore.subscribe(
          (state, prev) => {
            if (state.byCollection === prev.byCollection) return;
            recordByCollection(
              "POST-BOOT byCollection mutation",
              "REPLACE",
              state.byCollection,
              "Zustand setState changed byCollection after boot complete",
              snapshotListIds,
            );
          },
        );
        unsubs.push(unsubByCollection);

        logger.info("Cloud data hydrated", {
          userId: profile!.id,
          crewId: crewId ?? undefined,
        });
      } catch (error) {
        recordByCollection(
          "Cloud boot FAILED",
          "RESET",
          useLocalCollectionStore.getState().byCollection,
          error instanceof Error ? error.message : "unknown",
        );
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
  const snapshotListIds = snapshot.lists.map((list) => list.id);
  const snapshotNames = Object.fromEntries(
    snapshot.lists.map((list) => [list.id, list.name]),
  );

  recordByCollection(
    "mergeCloudSnapshot: BEFORE (local)",
    "READ",
    localByCollection,
    `localKeys=${JSON.stringify(Object.keys(localByCollection))}`,
    snapshotListIds,
    snapshotNames,
  );
  bootTrace.recordUi({
    stage: "Animated read path: mergeCloudSnapshot BEFORE (local)",
    rows: [
      {
        "Collection ID": ANIMATED_ID,
        "local byCollection movie IDs": (localByCollection[ANIMATED_ID] ?? []).map(
          (item) => item.movie.id,
        ),
        "local byCollection titles": (localByCollection[ANIMATED_ID] ?? []).map(
          (item) => item.movie.title,
        ),
        "local byCollection recommendation IDs": (
          localByCollection[ANIMATED_ID] ?? []
        ).map(() => null),
        "local byCollection movie count": (
          localByCollection[ANIMATED_ID] ?? []
        ).length,
      },
    ],
  });
  recordByCollection(
    "mergeCloudSnapshot: BEFORE (cloud snapshot)",
    "SNAPSHOT",
    snapshot.byCollection,
    `cloudKeys=${JSON.stringify(Object.keys(snapshot.byCollection))}`,
    snapshotListIds,
    snapshotNames,
  );

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

  recordByCollection(
    "mergeCloudSnapshot: computed mergedByCollection (pre-setState)",
    "MERGE",
    mergedByCollection,
    "about to REPLACE store.byCollection with mergedByCollection",
    snapshotListIds,
    snapshotNames,
  );
  bootTrace.recordUi({
    stage: "Animated read path: mergeCloudSnapshot mergedByCollection",
    rows: [
      {
        "Collection ID": ANIMATED_ID,
        "mergedByCollection movie IDs": (
          mergedByCollection[ANIMATED_ID] ?? []
        ).map((item) => item.movie.id),
        "mergedByCollection titles": (
          mergedByCollection[ANIMATED_ID] ?? []
        ).map((item) => item.movie.title),
        "mergedByCollection recommendation IDs": (
          mergedByCollection[ANIMATED_ID] ?? []
        ).map(() => null),
        "mergedByCollection movie count": (
          mergedByCollection[ANIMATED_ID] ?? []
        ).length,
      },
    ],
  });

  useLocalCollectionStore.setState({
    createdCollections: mergedCollections,
    byCollection: mergedByCollection,
    captures: localCaptures,
  });

  recordByCollection(
    "mergeCloudSnapshot: AFTER setState",
    "REPLACE",
    useLocalCollectionStore.getState().byCollection,
    "Zustand byCollection replaced with merged result",
    snapshotListIds,
    snapshotNames,
  );
  bootTrace.recordUi({
    stage: "Animated read path: after mergeCloudSnapshot setState",
    rows: [
      {
        "Collection ID": ANIMATED_ID,
        "store.byCollection movie IDs": (
          useLocalCollectionStore.getState().byCollection[ANIMATED_ID] ?? []
        ).map((item) => item.movie.id),
        "store.byCollection titles": (
          useLocalCollectionStore.getState().byCollection[ANIMATED_ID] ?? []
        ).map((item) => item.movie.title),
        "store.byCollection recommendation IDs": (
          useLocalCollectionStore.getState().byCollection[ANIMATED_ID] ?? []
        ).map(() => null),
        "store.byCollection movie count": (
          useLocalCollectionStore.getState().byCollection[ANIMATED_ID] ?? []
        ).length,
      },
    ],
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

  recordByCollection(
    "after collaboration setState (memberships)",
    "READ",
    useLocalCollectionStore.getState().byCollection,
    `memberships=${useCollaborationStore.getState().memberships.length}`,
    snapshotListIds,
  );

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
    recordByCollection(
      "after adoptCanonicalIdentity",
      "READ",
      useLocalCollectionStore.getState().byCollection,
      "identity remap / seed memberships — should not touch byCollection",
      snapshotListIds,
    );
  }
}

async function refreshFromCloud(
  userId: string,
  queryClient?: ReturnType<typeof useQueryClient>,
) {
  recordByCollection(
    "refreshFromCloud() ENTERED",
    "SUBSCRIBE",
    useLocalCollectionStore.getState().byCollection,
    "realtime or invalidate triggered second hydrate",
  );
  const [snapshot, crewSnapshot] = await Promise.all([
    loadCloudSnapshot(userId),
    crewService.getSnapshot(userId),
  ]);
  const snapshotListIds = snapshot.lists.map((list) => list.id);
  const snapshotNames = Object.fromEntries(
    snapshot.lists.map((list) => [list.id, list.name]),
  );
  recordByCollection(
    "refreshFromCloud: snapshot loaded",
    "SNAPSHOT",
    snapshot.byCollection,
    null,
    snapshotListIds,
    snapshotNames,
  );
  mergeCloudSnapshot(userId, snapshot);
  useCrewStore.getState().setSnapshot(crewSnapshot);
  if (crewSnapshot) {
    const presence = await getCloudRepositories().crew.listPresence(
      crewSnapshot.members.map((m) => m.userId),
    );
    useCrewStore.getState().setPresence(presence);
  }
  recordByCollection(
    "refreshFromCloud() DONE",
    "MERGE",
    useLocalCollectionStore.getState().byCollection,
    "second apply of cloud snapshot",
    snapshotListIds,
    snapshotNames,
  );
  void queryClient;
}
