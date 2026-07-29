import { getCloudRepositories } from "@/lib/repositories/cloud";
import type {
  CloudList,
  CloudRecommendation,
} from "@/lib/repositories/cloud/types";
import { logger } from "@/lib/observability/logger";
import type { Collection, CollectionItem, Movie, MovieVote } from "@/lib/types";

const LOCAL_MIGRATION_FLAG = "pickit-cloud-migration-v1";

type LegacyCollaboration = {
  users?: Array<{ id: string; name: string; email?: string; color?: string }>;
  activeUserId?: string;
};

type LegacyCollections = {
  byCollection?: Record<
    string,
    Array<{
      movie?: Movie;
      id?: string;
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

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: T } & T;
    if (parsed && typeof parsed === "object" && "state" in parsed) {
      return (parsed.state as T) ?? null;
    }
    return parsed as T;
  } catch {
    return null;
  }
}

/**
 * One-time import of Phase-1 local Zustand data into Supabase.
 * Local keys remain as a backup; cloud becomes canonical.
 */
export async function migrateLocalDataToSupabase(userId: string): Promise<{
  migrated: boolean;
  lists: number;
  ratings: number;
  recommendations: number;
}> {
  if (typeof window === "undefined") {
    return { migrated: false, lists: 0, ratings: 0, recommendations: 0 };
  }

  const repos = getCloudRepositories();
  const alreadyCloud = await repos.migrations.hasCompleted(
    userId,
    "local-to-cloud-v1",
  );
  if (alreadyCloud || window.localStorage.getItem(LOCAL_MIGRATION_FLAG) === "done") {
    if (!alreadyCloud) {
      await repos.migrations.markCompleted(userId, "local-to-cloud-v1");
    }
    return { migrated: false, lists: 0, ratings: 0, recommendations: 0 };
  }

  // Ensure personal Crew exists before attaching lists
  let crewId: string | null = null;
  try {
    const profile = await repos.auth.getProfile();
    const crew = await repos.crew.ensurePersonalCrew(
      userId,
      profile?.displayName ?? "My",
    );
    crewId = crew.id;
  } catch {
    crewId = null;
  }

  const legacyCollections = safeParse<LegacyCollections>(
    window.localStorage.getItem("decision-local-collections"),
  );
  const legacyVotes = safeParse<LegacyVotes>(
    window.localStorage.getItem("decision-votes"),
  );
  void safeParse<LegacyCollaboration>(
    window.localStorage.getItem("decision-collaboration"),
  );

  const now = new Date().toISOString();
  let listCount = 0;
  let recommendationCount = 0;
  let ratingCount = 0;

  const moviesToUpsert = new Map<string, Movie>();
  const lists: CloudList[] = [];
  const recommendations: CloudRecommendation[] = [];

  for (const collection of legacyCollections?.createdCollections ?? []) {
    const override = legacyCollections?.collectionOverrides?.[collection.id];
    if (override?.deleted) continue;

    lists.push({
      id: collection.id,
      ownerId: userId,
      crewId,
      name: override?.name ?? collection.name,
      emoji: override?.emoji ?? collection.emoji,
      description: collection.description ?? null,
      archivedAt: null,
      createdBy: userId,
      updatedBy: userId,
      createdAt: collection.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
    });

    const localAdds = legacyCollections?.byCollection?.[collection.id] ?? [];
    const items: CollectionItem[] = [
      ...collection.items,
      ...localAdds.map((entry) => {
        const movie = entry.movie;
        if (movie) moviesToUpsert.set(movie.id, movie);
        return {
          movieId: movie?.id ?? entry.id ?? "",
          source: entry.source ?? { type: "search", label: "Search" },
          metadata: entry.metadata as CollectionItem["metadata"],
          addedByUserId: entry.addedByUserId ?? userId,
          addedAt: entry.addedAt ?? now,
        };
      }),
    ];

    for (const item of items) {
      if (!item.movieId) continue;
      if (override?.removedMovieIds?.includes(item.movieId)) continue;
      recommendations.push({
        id: crypto.randomUUID(),
        listId: collection.id,
        movieId: item.movieId,
        sourceType: item.source.type,
        sourceLabel: item.source.label,
        metadata: (item.metadata as Record<string, unknown>) ?? {},
        note: item.note ?? item.metadata?.notes ?? null,
        addedByUserId: item.addedByUserId ?? userId,
        createdBy: userId,
        updatedBy: userId,
        createdAt: item.addedAt ?? now,
        updatedAt: now,
        deletedAt: null,
      });
    }
  }

  // Seed list local additions without createdCollections entry
  for (const [collectionId, entries] of Object.entries(
    legacyCollections?.byCollection ?? {},
  )) {
    if (lists.some((list) => list.id === collectionId)) continue;
    const override = legacyCollections?.collectionOverrides?.[collectionId];
    if (override?.deleted) continue;
    lists.push({
      id: collectionId,
      ownerId: userId,
      crewId,
      name: override?.name ?? collectionId,
      emoji: override?.emoji ?? "🎬",
      description: null,
      archivedAt: null,
      createdBy: userId,
      updatedBy: userId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    for (const entry of entries) {
      const movie = entry.movie;
      if (movie) moviesToUpsert.set(movie.id, movie);
      const movieId = movie?.id ?? entry.id;
      if (!movieId) continue;
      recommendations.push({
        id: crypto.randomUUID(),
        listId: collectionId,
        movieId,
        sourceType: entry.source?.type ?? "search",
        sourceLabel: entry.source?.label ?? "Search",
        metadata: entry.metadata ?? {},
        note: null,
        addedByUserId: entry.addedByUserId ?? userId,
        createdBy: userId,
        updatedBy: userId,
        createdAt: entry.addedAt ?? now,
        updatedAt: now,
        deletedAt: null,
      });
    }
  }

  try {
    await repos.movies.upsertMany([...moviesToUpsert.values()]);
    for (const list of lists) {
      await repos.lists.upsert(list);
      listCount += 1;
    }
    for (const recommendation of recommendations) {
      // Ensure movie stub exists if missing from map
      if (!moviesToUpsert.has(recommendation.movieId)) {
        await repos.movies.upsert({
          id: recommendation.movieId,
          title: recommendation.movieId,
          year: 0,
          runtime: 0,
          rating: 0,
          genres: [],
          overview: "",
          posterUrl: "",
          mediaType: "movie",
        });
      }
      await repos.recommendations.upsert(recommendation);
      recommendationCount += 1;
    }

    for (const vote of legacyVotes?.votes ?? []) {
      const votedAt = new Date(vote.votedAt).toISOString();
      await repos.ratings.upsert({
        listId: vote.collectionId,
        movieId: vote.movieId,
        userId,
        vote: vote.vote,
        votedAt,
        createdBy: userId,
        updatedBy: userId,
        createdAt: votedAt,
        updatedAt: votedAt,
        deletedAt: null,
      });
      ratingCount += 1;
    }

    // Preferences from settings store
    try {
      const settingsRaw = window.localStorage.getItem("pickit-settings");
      const settings = safeParse<{
        appearance?: string;
        analyticsOptIn?: boolean;
        developerMode?: boolean;
      }>(settingsRaw);
      if (settings) {
        await repos.preferences.upsert({
          userId,
          appearance: (settings.appearance as "dark" | "system") ?? "dark",
          analyticsOptIn: settings.analyticsOptIn ?? true,
          developerMode: settings.developerMode ?? false,
          extras: {},
          updatedAt: now,
        });
      }
    } catch {
      // ignore
    }

    await repos.migrations.markCompleted(userId, "local-to-cloud-v1");
    window.localStorage.setItem(LOCAL_MIGRATION_FLAG, "done");
    logger.info("Migrated local data to Supabase", {
      listCount,
      recommendationCount,
      ratingCount,
    });
  } catch (error) {
    logger.error("Cloud migration failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }

  return {
    migrated: true,
    lists: listCount,
    ratings: ratingCount,
    recommendations: recommendationCount,
  };
}

/** Hydrate Zustand in-memory stores from cloud (Crew-scoped). */
export async function loadCloudSnapshot(userId: string): Promise<{
  lists: Collection[];
  votes: MovieVote[];
  byCollection: Record<
    string,
    Array<{
      movie: Movie;
      source: { type: string; label: string };
      metadata?: Record<string, unknown>;
      addedByUserId: string;
      addedAt: string;
    }>
  >;
  crewId: string | null;
  memberProfiles: Array<{
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
    color?: string;
  }>;
  memberships: Array<{
    id: string;
    collectionId: string;
    userId: string;
    role: "owner" | "member";
    joinedAt: string;
  }>;
}> {
  const repos = getCloudRepositories();
  const crew = await repos.crew.getActiveCrewForUser(userId);
  const crewId = crew?.id ?? null;

  let lists = crewId
    ? await repos.lists.listForCrew(crewId)
    : await repos.lists.listForOwner(userId);

  // Include any orphan owned lists not yet attached
  if (crewId) {
    const owned = await repos.lists.listForOwner(userId);
    const ids = new Set(lists.map((list) => list.id));
    for (const list of owned) {
      if (!ids.has(list.id)) {
        if (!list.crewId) {
          const attached = await repos.lists.upsert({
            ...list,
            crewId,
            updatedAt: new Date().toISOString(),
            updatedBy: userId,
          });
          lists.push(attached);
        } else {
          lists.push(list);
        }
      }
    }
  }

  const listIds = lists.map((list) => list.id);
  const [recommendations, ratings] = await Promise.all([
    repos.recommendations.listForListIds(listIds),
    repos.ratings.listForListIds(listIds),
  ]);

  const memberProfilesRaw = crewId
    ? await repos.crew.listMemberProfiles(crewId)
    : [];
  const crewMembers = crewId ? await repos.crew.listMembers(crewId) : [];

  const movieIds = [
    ...new Set([
      ...recommendations.map((item) => item.movieId),
      ...ratings.map((item) => item.movieId),
    ]),
  ];
  const movies = await repos.movies.getByIds(movieIds);
  const movieMap = new Map(movies.map((movie) => [movie.id, movie]));

  const byCollection: Record<
    string,
    Array<{
      movie: Movie;
      source: { type: string; label: string };
      metadata?: Record<string, unknown>;
      addedByUserId: string;
      addedAt: string;
    }>
  > = {};

  for (const item of recommendations) {
    const movie = movieMap.get(item.movieId);
    if (!movie) continue;
    if (!byCollection[item.listId]) byCollection[item.listId] = [];
    byCollection[item.listId].push({
      movie,
      source: {
        type: item.sourceType ?? "search",
        label: item.sourceLabel ?? "Search",
      },
      metadata: item.metadata,
      addedByUserId: item.addedByUserId,
      addedAt: item.createdAt,
    });
  }

  const collectionLists: Collection[] = lists.map((list) => ({
    id: list.id,
    name: list.name,
    emoji: list.emoji,
    description: list.description ?? undefined,
    ownerId: list.ownerId,
    householdId: list.crewId,
    createdBy: list.createdBy,
    updatedBy: list.updatedBy,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    deletedAt: list.deletedAt,
    archivedAt: list.archivedAt,
    items: (byCollection[list.id] ?? []).map((entry) => ({
      movieId: entry.movie.id,
      source: entry.source,
      metadata: entry.metadata as Collection["items"][number]["metadata"],
      addedByUserId: entry.addedByUserId,
      addedAt: entry.addedAt,
    })),
  }));

  const votes: MovieVote[] = ratings.map((rating) => ({
    collectionId: rating.listId,
    movieId: rating.movieId,
    userId: rating.userId,
    vote: rating.vote,
    votedAt: new Date(rating.votedAt),
    createdBy: rating.createdBy,
    updatedBy: rating.updatedBy,
    createdAt: rating.createdAt,
    updatedAt: rating.updatedAt,
    deletedAt: rating.deletedAt,
  }));

  const memberProfiles = memberProfilesRaw.map((profile) => ({
    id: profile.id,
    name: profile.displayName,
    email: profile.email ?? undefined,
    avatarUrl: profile.avatarUrl ?? undefined,
    color: profile.color,
  }));

  // Membership per list for stats selector (every crew member on every crew list)
  const memberships = lists.flatMap((list) =>
    crewMembers.map((member) => ({
      id: `membership-${list.id}-${member.userId}`,
      collectionId: list.id,
      userId: member.userId,
      role:
        member.role === "owner" && list.ownerId === member.userId
          ? ("owner" as const)
          : ("member" as const),
      joinedAt: member.joinedAt,
    })),
  );

  return {
    lists: collectionLists,
    votes,
    byCollection,
    crewId,
    memberProfiles,
    memberships,
  };
}
