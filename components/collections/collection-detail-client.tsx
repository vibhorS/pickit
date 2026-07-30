"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Film, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AddMovieModal } from "@/components/collections/add-movie-modal";
import { CollectionActivity } from "@/components/collections/collection-activity";
import { CollectionCollaborationPanel } from "@/components/collections/collection-collaboration-panel";
import { CollectionRecommendationInsights } from "@/components/collections/collection-recommendation-insights";
import { MovieGridCard } from "@/components/movie/movie-grid-card";
import { EmptyState, Toast } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import { useWatchProviders } from "@/hooks/use-watch-providers";
import { MOTION, staggerContainer } from "@/lib/motion";
import { sourceFromMetadata } from "@/lib/recommendation-metadata";
import { TMDB_SEARCH_SOURCE } from "@/lib/recommendation-source";
import type {
  Collection,
  Movie,
  RecommendationMetadata,
  VoteValue,
} from "@/lib/types";
import { can } from "@/lib/services/collaboration/permissions";
import { expandCrewProviderIds } from "@/lib/streaming/provider-catalog";
import { useCollectionStats } from "@/store/collection-stats-selector";
import { useCollaborationStore } from "@/store/collaboration-store";
import {
  selectCrewStreamingProviderIds,
  useCrewPreferencesStore,
} from "@/store/crew-preferences-store";
import { useCrewStore } from "@/store/crew-store";
import { useLocalCollectionStore } from "@/store/local-collection-store";

type CollectionDetailClientProps = {
  collection: Collection;
};

type MovieFilter = "all" | "unrated" | "rated" | "matches";

export function CollectionDetailClient({
  collection,
}: CollectionDetailClientProps) {
  const router = useRouter();
  const [isAddMovieOpen, setIsAddMovieOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [editingList, setEditingList] = useState(false);
  const [listName, setListName] = useState(collection.name);
  const [listEmoji, setListEmoji] = useState(collection.emoji);
  const [selectedFilter, setSelectedFilter] = useState<MovieFilter | null>(
    null,
  );

  useEffect(() => {
    if (
      new URLSearchParams(window.location.search).get("add") === "1"
    ) {
      queueMicrotask(() => setIsAddMovieOpen(true));
    }
  }, []);

  const addLocalMovie = useLocalCollectionStore((state) => state.addMovie);
  const createCollection = useLocalCollectionStore(
    (state) => state.createCollection,
  );
  const renameCollection = useLocalCollectionStore(
    (state) => state.renameCollection,
  );
  const deleteCollection = useLocalCollectionStore(
    (state) => state.deleteCollection,
  );
  const removeMovie = useLocalCollectionStore(
    (state) => state.removeMovie,
  );
  const memberships = useCollaborationStore(
    (state) => state.memberships,
  );
  const stats = useCollectionStats(collection.id);
  const {
    items,
    totalMovies,
    myRated: youRated,
    unratedMine: remaining,
    mutualMatches: mutualCount,
    mutualMatchMovies,
    currentUser,
    members,
    ratings,
  } = stats;
  const crew = useCrewStore((state) => state.crew);
  const crewId = crew?.id;
  const crewCountry = useCrewPreferencesStore((state) =>
    crewId ? state.byCrewId[crewId]?.country : undefined,
  );
  const selectedProviderIds = useCrewPreferencesStore((state) =>
    selectCrewStreamingProviderIds(state, crewId),
  );
  const householdProviderIds = useMemo(
    () => expandCrewProviderIds(selectedProviderIds),
    [selectedProviderIds],
  );
  const watchRefs = useMemo(
    () =>
      items.map((entry) => ({
        id: entry.movie.id,
        mediaType: entry.movie.mediaType === "tv" ? ("tv" as const) : ("movie" as const),
      })),
    [items],
  );
  const { byId: watchById } = useWatchProviders(watchRefs, {
    regionContext: { crewCountry },
  });
  const canManage = can("list.rename", {
    userId: currentUser.id,
    collection,
    memberships,
  });
  const canDelete = can("list.delete", {
    userId: currentUser.id,
    collection,
    memberships,
  });
  const canDuplicate = can("list.duplicate", {
    userId: currentUser.id,
    collection,
    memberships,
  });

  async function handleDuplicateList() {
    if (!canDuplicate) return;
    const copy = createCollection(
      `${collection.name} Copy`,
      collection.emoji,
    );
    // Copy current items into the new list via local store.
    for (const item of items) {
      addLocalMovie(
        copy.id,
        item.movie,
        item.source,
        item.metadata,
      );
    }
    setToastMessage(`Duplicated as ${copy.name}`);
    router.push(`/collection/${copy.id}`);
  }

  const userVotes = ratings.filter(
    (vote) =>
      vote.collectionId === collection.id &&
      vote.userId === currentUser.id,
  );
  const mutualIds = new Set(
    mutualMatchMovies.map((movie) => movie.id),
  );

  const ratedItems = items.filter((item) =>
    userVotes.some((vote) => vote.movieId === item.movie.id),
  );
  const unratedItems = items.filter(
    (item) => !userVotes.some((vote) => vote.movieId === item.movie.id),
  );
  const matchItems = items.filter((item) => mutualIds.has(item.movie.id));

  const movieFilter: MovieFilter =
    selectedFilter ?? (remaining > 0 ? "unrated" : "all");
  const visibleItems =
    movieFilter === "rated"
      ? ratedItems
      : movieFilter === "unrated"
        ? unratedItems
        : movieFilter === "matches"
          ? matchItems
          : items;

  const description =
    collection.description?.trim() ||
    "A list of recommendations waiting to be decided.";

  const movieCountLabel =
    totalMovies === 1 ? "1 movie" : `${totalMovies} movies`;

  useEffect(() => {
    if (!toastMessage) return;
    const timeoutId = window.setTimeout(() => setToastMessage(null), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  useEffect(() => {
    if (!collection.id) return;
    router.prefetch(`/rate/${collection.id}`);
  }, [collection.id, router]);

  function handleAddMovie(
    movie: Movie,
    metadata: RecommendationMetadata,
  ) {
    if (!collection.id) {
      setToastMessage("Couldn't add that movie — the list is missing.");
      return;
    }
    if (!movie?.id) {
      setToastMessage("Couldn't add that movie — missing movie id.");
      return;
    }

    const alreadyInCollection = items.some(
      (item) => item.movie.id === movie.id,
    );
    if (alreadyInCollection) {
      setIsAddMovieOpen(false);
      setToastMessage(`Already in ${collection.name}`);
      return;
    }

    const source = sourceFromMetadata(metadata, TMDB_SEARCH_SOURCE);
    const added = addLocalMovie(
      collection.id,
      movie,
      source,
      metadata,
    );
    setIsAddMovieOpen(false);
    setToastMessage(
      added
        ? `Added to ${collection.name}`
        : `Already in ${collection.name}`,
    );
  }

  function handleRenameList() {
    if (!listName.trim()) return;
    renameCollection(collection.id, listName, listEmoji);
    setEditingList(false);
    setToastMessage("List updated");
  }

  function handleDeleteList() {
    if (!window.confirm(`Delete ${collection.name}?`)) return;
    deleteCollection(collection.id);
    router.push("/collections");
  }

  function handleRemoveMovie(movie: Movie) {
    if (!window.confirm(`Remove ${movie.title} from this list?`)) return;
    removeMovie(collection.id, movie.id);
    setToastMessage(`Removed ${movie.title}`);
  }

  function handleOpenMovie(movie: Movie) {
    if (!collection.id || !movie?.id) {
      setToastMessage("Couldn't open that movie. Try again.");
      return;
    }

    const href = `/collection/${collection.id}/movie/${movie.id}`;
    router.prefetch(href);
    router.push(href);
  }

  function voteForMovie(
    movieId: string,
    userId: string,
  ): VoteValue | undefined {
    return ratings.find(
      (vote) =>
        vote.movieId === movieId && vote.userId === userId,
    )?.vote;
  }

  function emptyFilterCopy() {
    if (movieFilter === "rated") {
      return {
        title: "Nothing rated yet",
        description:
          "Open a title and mark I'd Watch or Not for Me to build your list.",
      };
    }
    if (movieFilter === "matches") {
      return {
        title: "No mutual matches yet",
        description:
          "Matches appear when every member marks I'd Watch on the same movie.",
      };
    }
    if (movieFilter === "unrated") {
      return {
        title:
          stats.readinessState === "waiting-for-members"
            ? stats.readinessLabel
            : "You're all caught up",
        description:
          stats.readinessState === "waiting-for-members"
            ? `You've rated every movie. ${stats.waitingMemberNames.join(
                ", ",
              )} still ${
                stats.waitingMemberNames.length === 1 ? "has" : "have"
              } ratings left.`
            : "Everyone has rated every movie in this list.",
      };
    }
    return {
      title: "Nothing to show",
      description: "Try another filter.",
    };
  }

  const emptyCopy = emptyFilterCopy();

  return (
    <>
      <FadeIn className="mx-auto w-full max-w-5xl">
        <header>
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-netflix-red">
            Manage List
          </p>
          <div className="flex items-start gap-5 sm:gap-6">
            <span
              aria-hidden="true"
              className="text-5xl leading-none sm:text-6xl"
            >
              {collection.emoji}
            </span>
            <div className="min-w-0 space-y-3 pt-1">
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                {collection.name}
              </h1>
              <p className="text-sm text-netflix-muted">{movieCountLabel}</p>
              <p className="max-w-lg text-sm leading-relaxed text-netflix-muted/80 sm:text-[0.9375rem]">
                {description}
              </p>
              {totalMovies > 0 && (
                <p className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1 text-xs font-medium text-white">
                  <span aria-hidden="true">{stats.readinessEmoji}</span>
                  {stats.readinessLabel}
                </p>
              )}
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => setEditingList((value) => !value)}
                className="btn-ghost ml-auto inline-flex shrink-0 items-center gap-2"
              >
                <Pencil className="size-4" aria-hidden="true" />
                Rename
              </button>
            )}
          </div>
          {editingList && (
            <div className="mt-6 flex max-w-xl flex-col gap-3 rounded-2xl bg-white/[0.035] p-4 sm:flex-row">
              <input
                value={listEmoji}
                onChange={(event) =>
                  setListEmoji(event.target.value.slice(0, 4))
                }
                aria-label="List emoji"
                className="w-16 rounded-xl bg-black/30 px-3 py-2.5 text-center text-xl outline-none focus:ring-2 focus:ring-netflix-red/50"
              />
              <input
                value={listName}
                onChange={(event) => setListName(event.target.value)}
                aria-label="List name"
                className="min-w-0 flex-1 rounded-xl bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-netflix-red/50"
              />
              <button
                type="button"
                onClick={handleRenameList}
                disabled={!listName.trim()}
                className="btn-secondary"
              >
                Save
              </button>
            </div>
          )}
        </header>

        <CollectionCollaborationPanel collectionId={collection.id} />
        <CollectionActivity collectionId={collection.id} />

        <div className="mt-8 max-w-4xl">
          <CollectionRecommendationInsights items={items} />
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsAddMovieOpen(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="size-4" aria-hidden="true" strokeWidth={2} />
            Add Recommendation
          </button>
          {totalMovies > 0 && (
            <Link
              href={`/rate/${collection.id}`}
              prefetch
              className="btn-secondary"
            >
              Rate Movies
            </Link>
          )}
          {canDuplicate && (
            <button
              type="button"
              onClick={() => void handleDuplicateList()}
              className="btn-secondary"
            >
              Duplicate
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={handleDeleteList}
              className="btn-ghost ml-auto inline-flex items-center gap-2 text-red-300 hover:text-red-200"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete List
            </button>
          )}
        </div>

        {totalMovies === 0 ? (
          <EmptyState
            icon={<Film className="size-7" strokeWidth={1.5} />}
            title="This list is waiting for its first recommendation."
            description="Add a movie you discovered somewhere — a friend, a feed, or a late-night search."
            action={{
              label: "Add Your First Recommendation",
              onClick: () => setIsAddMovieOpen(true),
            }}
          />
        ) : (
          <>
            <section className="mt-14 sm:mt-16">
              <div
                role="tablist"
                aria-label="Filter movies"
                className="mb-8 flex flex-wrap items-center gap-1"
              >
                {(
                  [
                    ["all", `All (${totalMovies})`],
                    ["unrated", `Unrated (${remaining})`],
                    ["rated", `Rated (${youRated})`],
                    ["matches", `Matches (${mutualCount})`],
                  ] as const
                ).map(([filter, label]) => (
                  <button
                    key={filter}
                    type="button"
                    role="tab"
                    aria-selected={movieFilter === filter}
                    onClick={() => setSelectedFilter(filter)}
                    className={`min-h-11 rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${
                      movieFilter === filter
                        ? "bg-white/[0.08] font-medium text-white"
                        : "text-netflix-muted hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={movieFilter}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{
                    duration: MOTION.duration,
                    ease: MOTION.ease,
                  }}
                >
                  {visibleItems.length === 0 ? (
                    <EmptyState
                      icon={<Film className="size-7" strokeWidth={1.5} />}
                      title={emptyCopy.title}
                      description={emptyCopy.description}
                    />
                  ) : (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 md:grid-cols-4 lg:grid-cols-5 lg:gap-x-7 lg:gap-y-14"
                    >
                      {visibleItems.map((item) => (
                        <div key={item.movie.id} className="relative">
                          {canManage && (
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveMovie(item.movie)
                              }
                              aria-label={`Remove ${item.movie.title} from list`}
                              className="absolute -right-2 -top-2 z-20 grid size-11 place-items-center rounded-full bg-black/85 text-netflix-muted shadow-lg transition hover:bg-netflix-red hover:text-white"
                            >
                              <X className="size-4" aria-hidden="true" />
                            </button>
                          )}
                          <MovieGridCard
                            movie={item.movie}
                            source={item.source}
                            metadata={item.metadata}
                            watchAvailability={watchById.get(item.movie.id)}
                            householdProviderIds={householdProviderIds}
                            memberRatings={members.map((member) => ({
                              userId: member.id,
                              name: member.name,
                              isCurrentUser:
                                member.id === currentUser.id,
                              vote: voteForMovie(
                                item.movie.id,
                                member.id,
                              ),
                            }))}
                            addedByName={(() => {
                              const adderName =
                                item.addedByUserId === currentUser.id
                                  ? "you"
                                  : members.find(
                                      (member) =>
                                        member.id === item.addedByUserId,
                                    )?.name ?? "a member";
                              const sourceLabel = item.source?.label?.trim();
                              return sourceLabel
                                ? `Added by ${adderName} • ${sourceLabel}`
                                : `Added by ${adderName}`;
                            })()}
                            onOpen={handleOpenMovie}
                          />
                        </div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            </section>
          </>
        )}
      </FadeIn>

      <AddMovieModal
        open={isAddMovieOpen}
        existingMovieIds={items.map((item) => item.movie.id)}
        onClose={() => setIsAddMovieOpen(false)}
        onAdd={handleAddMovie}
      />

      <Toast message={toastMessage} />
    </>
  );
}
