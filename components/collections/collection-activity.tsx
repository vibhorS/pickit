"use client";

import { useEffect, useState } from "react";
import { useCollaborationStore } from "@/store/collaboration-store";

type CollectionActivityProps = {
  collectionId: string;
};

function formatActivityLine(input: {
  userName: string;
  type: string;
  movieTitle?: string;
}): string | null {
  switch (input.type) {
    case "movie-added":
      return input.movieTitle
        ? `${input.userName} recommended ${input.movieTitle}`
        : `${input.userName} added a recommendation`;
    case "movie-rated":
      return input.movieTitle
        ? `${input.userName} rated ${input.movieTitle}`
        : `${input.userName} rated a movie`;
    case "ratings-completed":
      return `${input.userName} finished rating`;
    case "movie-night-completed":
      return "Movie Night completed";
    case "list-created":
      return `${input.userName} created this list`;
    case "list-shared":
      return "List shared with partner";
    case "partner-joined":
      return `${input.userName} joined as partner`;
    case "recommendation-removed":
      return input.movieTitle
        ? `${input.userName} removed ${input.movieTitle}`
        : `${input.userName} removed a recommendation`;
    default:
      return null;
  }
}

/** Lightweight shared activity timeline — informative, not social. */
export function CollectionActivity({
  collectionId,
}: CollectionActivityProps) {
  const [hydrated, setHydrated] = useState(false);
  const activity = useCollaborationStore((state) => state.activity);
  const users = useCollaborationStore((state) => state.users);

  useEffect(() => {
    const finish = () => setHydrated(true);
    const unsubscribe =
      useCollaborationStore.persist.onFinishHydration(finish);
    if (useCollaborationStore.persist.hasHydrated()) {
      queueMicrotask(finish);
    }
    return unsubscribe;
  }, []);

  if (!hydrated) return null;

  const recent = activity
    .filter((event) => event.collectionId === collectionId)
    .slice(0, 8);

  const lines = recent.flatMap((event) => {
    const user = users.find((entry) => entry.id === event.userId);
    const line = formatActivityLine({
      userName: user?.name ?? "Someone",
      type: event.type,
      movieTitle: event.summary,
    });
    return line
      ? [
          {
            id: event.id,
            line,
            at: event.occurredAt,
          },
        ]
      : [];
  });

  // Fallback: compact “today” summaries when timeline is sparse
  if (lines.length === 0) {
    const today = new Date().toDateString();
    const todayEvents = activity.filter(
      (event) =>
        event.collectionId === collectionId &&
        new Date(event.occurredAt).toDateString() === today,
    );
    const summaries = users.flatMap((user) => {
      const userEvents = todayEvents.filter(
        (event) => event.userId === user.id,
      );
      return (["movie-rated", "movie-added"] as const).flatMap((type) => {
        const count = new Set(
          userEvents
            .filter((event) => event.type === type)
            .map((event) => event.movieId ?? event.id),
        ).size;
        if (count === 0) return [];
        const verb = type === "movie-rated" ? "rated" : "added";
        return [
          `${user.name} ${verb} ${count} ${
            count === 1 ? "movie" : "movies"
          } today.`,
        ];
      });
    });
    if (summaries.length === 0) return null;
    return (
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-netflix-muted/70">
        {summaries.slice(0, 3).map((summary) => (
          <p key={summary}>{summary}</p>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-1.5">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-netflix-muted/60">
        Activity
      </p>
      {lines.map((entry) => (
        <p key={entry.id} className="text-xs text-netflix-muted/80">
          {entry.line}
        </p>
      ))}
    </div>
  );
}
