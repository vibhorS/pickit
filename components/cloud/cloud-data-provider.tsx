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
import { cloudSyncEngine } from "@/lib/sync/cloud-sync-engine";
import { logger } from "@/lib/observability/logger";
import { useAuthStore } from "@/store/auth-store";
import { useCrewStore } from "@/store/crew-store";
import { useLocalCollectionStore } from "@/store/local-collection-store";
import { useVoteStore } from "@/store/vote-store";
import { useCollaborationStore } from "@/store/collaboration-store";
import { useSettingsStore } from "@/store/settings-store";

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

        applyCloudSnapshot(profile!.id, snapshot);
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

        if (crewId) {
          unsubs.push(
            repos.crew.subscribe(crewId, () => {
              void refreshFromCloud(profile!.id);
            }),
          );
          unsubs.push(
            repos.lists.subscribeCrew(crewId, () => {
              void refreshFromCloud(profile!.id);
              void queryClient.invalidateQueries({
                queryKey: queryKeys.lists(profile!.id),
              });
            }),
          );
        } else {
          unsubs.push(
            repos.lists.subscribe(profile!.id, () => {
              void refreshFromCloud(profile!.id);
              void queryClient.invalidateQueries({
                queryKey: queryKeys.lists(profile!.id),
              });
            }),
          );
        }

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
      for (const unsub of unsubs) unsub();
      if (profile) {
        void crewService.setPresence(profile.id, "offline");
      }
    };
  }, [profile, queryClient]);

  return <>{children}</>;
}

function applyCloudSnapshot(
  userId: string,
  snapshot: Awaited<ReturnType<typeof loadCloudSnapshot>>,
) {
  useVoteStore.getState().replaceVotes(snapshot.votes);
  useLocalCollectionStore.setState({
    createdCollections: snapshot.lists,
    byCollection: snapshot.byCollection,
    collectionOverrides: {},
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
    // Ensure current user is present even before crew profiles load
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
      users: Array.from(byId.values()),
      activeUserId: userId,
      memberships: snapshot.memberships.length
        ? snapshot.memberships
        : state.memberships,
    };
  });
}

async function refreshFromCloud(userId: string) {
  const [snapshot, crewSnapshot] = await Promise.all([
    loadCloudSnapshot(userId),
    crewService.getSnapshot(userId),
  ]);
  applyCloudSnapshot(userId, snapshot);
  useCrewStore.getState().setSnapshot(crewSnapshot);
  if (crewSnapshot) {
    const presence = await getCloudRepositories().crew.listPresence(
      crewSnapshot.members.map((m) => m.userId),
    );
    useCrewStore.getState().setPresence(presence);
  }
}
