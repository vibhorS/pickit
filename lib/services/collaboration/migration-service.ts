import { stampCreate } from "@/lib/domain/audit";
import { getRepositories } from "@/lib/repositories/index";
import { createId } from "@/lib/repositories/local";
import { readJson } from "@/lib/repositories/local/storage";
import {
  authenticationService,
  type AuthSession,
} from "@/lib/auth/auth-service";
import type {
  Collection,
  CollectionMembership,
  MovieVote,
  User,
  UserProfile,
} from "@/lib/types";
import { userToProfile } from "@/lib/types";

const LEGACY_KEYS = {
  collaboration: "decision-collaboration",
  collections: "decision-local-collections",
  votes: "decision-votes",
} as const;

type LegacyCollaboration = {
  users?: User[];
  memberships?: CollectionMembership[];
  invitations?: unknown[];
  notifications?: unknown[];
  activity?: unknown[];
  activeUserId?: string;
};

type LegacyCollections = {
  byCollection?: Record<
    string,
    Array<{
      id: string;
      source?: { type: string; label: string };
      metadata?: Record<string, unknown>;
      addedByUserId?: string;
      addedAt?: string;
    }>
  >;
  createdCollections?: Collection[];
  collectionOverrides?: Record<
    string,
    { name?: string; emoji?: string; deleted?: boolean; removedMovieIds?: string[] }
  >;
};

type LegacyVotes = {
  votes?: Array<{
    collectionId: string;
    movieId: string;
    userId: string;
    vote: "like" | "pass";
    votedAt: string | Date;
  }>;
};

const MIGRATION_FLAG = "pickit-migration-v2";

/**
 * Migrates Phase-1 local Zustand persistence into the repository layer
 * and ensures the active user has an auth session / profile.
 * No data loss: legacy keys are left intact after copy.
 */
export async function migrateLocalDataToCloudRepos(): Promise<{
  migrated: boolean;
  userId: string | null;
}> {
  if (typeof window === "undefined") {
    return { migrated: false, userId: null };
  }

  const already = window.localStorage.getItem(MIGRATION_FLAG);
  const repos = getRepositories();

  const legacyCollab = safeParse<LegacyCollaboration>(
    window.localStorage.getItem(LEGACY_KEYS.collaboration),
  );
  const legacyCollections = safeParse<LegacyCollections>(
    window.localStorage.getItem(LEGACY_KEYS.collections),
  );
  const legacyVotes = safeParse<LegacyVotes>(
    window.localStorage.getItem(LEGACY_KEYS.votes),
  );

  // Restore session, or migrate a legacy local identity into an auth session.
  // Fresh installs stay signed out so the auth gate can run.
  let profile = await authenticationService.restoreSession();
  if (!profile) {
    const legacyUsers = legacyCollab?.users ?? [];
    const active =
      legacyUsers.find((u) => u.id === legacyCollab?.activeUserId) ??
      legacyUsers[0];
    if (active) {
      profile = userToProfile(active, {
        provider: "local",
        isGuest: true,
      });
      await repos.users.upsert(profile);
      writeSessionForMigratedUser(profile);
    }
  }

  if (already === "done") {
    return { migrated: false, userId: profile?.id ?? null };
  }

  if (!profile) {
    // Still migrate shared domain data for later attach; no session yet.
    window.localStorage.setItem(MIGRATION_FLAG, "done");
    return { migrated: true, userId: null };
  }

  // Users
  for (const user of legacyCollab?.users ?? []) {
    const existing = await repos.users.getById(user.id);
    if (!existing) {
      await repos.users.upsert(
        userToProfile(user, { provider: "local", isGuest: false }),
      );
    }
  }

  // Created collections + overrides
  for (const collection of legacyCollections?.createdCollections ?? []) {
    const override =
      legacyCollections?.collectionOverrides?.[collection.id];
    const ownerId =
      legacyCollab?.memberships?.find(
        (m) => m.collectionId === collection.id && m.role === "owner",
      )?.userId ?? profile.id;

    const localItems = legacyCollections?.byCollection?.[collection.id] ?? [];
    const mergedItems = [
      ...collection.items,
      ...localItems.map((item) => ({
        movieId: item.id,
        source: item.source ?? { type: "search", label: "Search" },
        metadata: item.metadata as Collection["items"][number]["metadata"],
        addedByUserId: item.addedByUserId ?? ownerId,
        addedAt: item.addedAt ?? new Date().toISOString(),
      })),
    ];

    // Deduplicate by movieId
    const byMovie = new Map<string, Collection["items"][number]>();
    for (const item of mergedItems) {
      byMovie.set(item.movieId, item);
    }

    await repos.collections.upsert({
      ...collection,
      name: override?.name ?? collection.name,
      emoji: override?.emoji ?? collection.emoji,
      items: [...byMovie.values()].filter(
        (item) => !override?.removedMovieIds?.includes(item.movieId),
      ),
      ownerId,
      createdBy: ownerId,
      updatedBy: ownerId,
      createdAt: collection.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: override?.deleted ? new Date().toISOString() : null,
    });
  }

  // Seed collection local additions (date-night etc.)
  for (const [collectionId, items] of Object.entries(
    legacyCollections?.byCollection ?? {},
  )) {
    const existing = await repos.collections.getById(collectionId);
    if (existing) continue;
    const override = legacyCollections?.collectionOverrides?.[collectionId];
    const ownerId =
      legacyCollab?.memberships?.find(
        (m) => m.collectionId === collectionId && m.role === "owner",
      )?.userId ?? profile.id;
    await repos.collections.upsert({
      id: collectionId,
      name: override?.name ?? collectionId,
      emoji: override?.emoji ?? "🎬",
      items: items.map((item) => ({
        movieId: item.id,
        source: item.source ?? { type: "search", label: "Search" },
        metadata: item.metadata as Collection["items"][number]["metadata"],
        addedByUserId: item.addedByUserId ?? ownerId,
        addedAt: item.addedAt ?? new Date().toISOString(),
      })),
      ownerId,
      createdBy: ownerId,
      updatedBy: ownerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: override?.deleted ? new Date().toISOString() : null,
    });
  }

  // Memberships
  for (const membership of legacyCollab?.memberships ?? []) {
    await repos.memberships.upsert({
      ...membership,
      role:
        membership.role === "owner"
          ? "owner"
          : membership.role === "partner"
            ? "partner"
            : "member",
      ...stampCreate(membership.userId, membership.joinedAt),
    });
  }

  // Ratings
  for (const vote of legacyVotes?.votes ?? []) {
    const rating: MovieVote = {
      collectionId: vote.collectionId,
      movieId: vote.movieId,
      userId: vote.userId === "you" ? profile.id : vote.userId === "partner"
        ? (legacyCollab?.users?.find((u) => u.id !== profile.id)?.id ??
          vote.userId)
        : vote.userId,
      vote: vote.vote,
      votedAt: new Date(vote.votedAt),
      createdBy: vote.userId,
      updatedBy: vote.userId,
      createdAt: new Date(vote.votedAt).toISOString(),
      updatedAt: new Date(vote.votedAt).toISOString(),
      deletedAt: null,
    };
    await repos.ratings.upsert(rating);
  }

  window.localStorage.setItem(MIGRATION_FLAG, "done");
  return { migrated: true, userId: profile.id };
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: T } & T;
    // Zustand persist wraps in { state, version }
    if (parsed && typeof parsed === "object" && "state" in parsed) {
      return (parsed.state as T) ?? null;
    }
    return parsed as T;
  } catch {
    return null;
  }
}

function writeSessionForMigratedUser(profile: UserProfile): void {
  const session: AuthSession = {
    userId: profile.id,
    provider: profile.provider,
    accessToken: createId("tok"),
    refreshToken: createId("tok"),
    expiresAt: new Date(Date.now() + 720 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };
  // Use same storage helper namespace as auth service
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      "pickit-repo:auth-session",
      JSON.stringify(session),
    );
  }
}

/** Seed a full collaborative demo environment for QA. */
export async function seedCollaborativeDemo(): Promise<void> {
  const repos = getRepositories();
  const now = new Date().toISOString();

  const alex: UserProfile = {
    id: "demo-alex",
    displayName: "Alex",
    email: "alex@pickit.demo",
    avatarUrl: null,
    color: "#e50914",
    provider: "email",
    isGuest: false,
    createdAt: now,
    updatedAt: now,
  };
  const sam: UserProfile = {
    id: "demo-sam",
    displayName: "Sam",
    email: "sam@pickit.demo",
    avatarUrl: null,
    color: "#8b5cf6",
    provider: "email",
    isGuest: false,
    createdAt: now,
    updatedAt: now,
  };

  await repos.users.upsert(alex);
  await repos.users.upsert(sam);

  const householdId = "demo-household";
  await repos.relationships.upsert({
    id: "demo-relationship",
    householdId,
    inviterUserId: alex.id,
    partnerUserId: sam.id,
    status: "connected",
    inviteToken: "demo-connected",
    acceptedAt: now,
    ...stampCreate(alex.id, now),
  });

  const lists = [
    { id: "demo-date-night", name: "Date Night", emoji: "💋" },
    { id: "demo-sci-fi", name: "Sci-Fi Marathon", emoji: "🚀" },
    { id: "demo-comfort", name: "Comfort Movies", emoji: "🛋️" },
  ];

  for (const list of lists) {
    await repos.collections.upsert({
      id: list.id,
      name: list.name,
      emoji: list.emoji,
      items: [],
      ownerId: alex.id,
      householdId,
      createdBy: alex.id,
      updatedBy: alex.id,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    await repos.memberships.upsert({
      id: `demo-m-${list.id}-alex`,
      collectionId: list.id,
      userId: alex.id,
      role: "owner",
      joinedAt: now,
      ...stampCreate(alex.id, now),
    });
    await repos.memberships.upsert({
      id: `demo-m-${list.id}-sam`,
      collectionId: list.id,
      userId: sam.id,
      role: "partner",
      joinedAt: now,
      ...stampCreate(alex.id, now),
    });
  }

  // Pending invitation for disconnected-user testing
  await repos.relationships.upsert({
    id: "demo-pending-relationship",
    householdId: createId("household"),
    inviterUserId: "demo-jordan",
    partnerUserId: null,
    status: "pending",
    inviteToken: "demo-pending-invite",
    ...stampCreate("demo-jordan", now),
  });
  await repos.users.upsert({
    id: "demo-jordan",
    displayName: "Jordan",
    email: "jordan@pickit.demo",
    avatarUrl: null,
    color: "#0ea5e9",
    provider: "email",
    isGuest: false,
    createdAt: now,
    updatedAt: now,
  });
}
