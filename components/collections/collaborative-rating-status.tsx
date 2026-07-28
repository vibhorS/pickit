"use client";

import {
  formatRatingStateLabel,
  getRatingDisplayState,
} from "@/lib/collaboration";
import type { MovieVote } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";

type RatingStatusProps = {
  collectionId: string;
  movieId: string;
  ratings: MovieVote[];
  compact?: boolean;
};

/** Shows your rating vs partner rating / waiting states. */
export function CollaborativeRatingStatus({
  collectionId,
  movieId,
  ratings,
  compact = false,
}: RatingStatusProps) {
  const profile = useAuthStore((state) => state.profile);
  const partner = useAuthStore((state) => state.partner);
  if (!profile) return null;

  const state = getRatingDisplayState({
    movieId,
    collectionId,
    currentUserId: profile.id,
    partnerUserId: partner.partner?.id,
    ratings,
  });

  const mine = ratings.find(
    (r) =>
      r.collectionId === collectionId &&
      r.movieId === movieId &&
      r.userId === profile.id,
  );
  const theirs =
    partner.partner &&
    ratings.find(
      (r) =>
        r.collectionId === collectionId &&
        r.movieId === movieId &&
        r.userId === partner.partner!.id,
    );

  if (compact) {
    return (
      <span className="text-[0.65rem] text-netflix-muted">
        {formatRatingStateLabel(state)}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-netflix-muted">
      <span>
        You:{" "}
        <span className="text-white">
          {mine ? (mine.vote === "like" ? "Liked" : "Passed") : "—"}
        </span>
      </span>
      {partner.partner && (
        <span>
          {partner.partner.displayName}:{" "}
          <span className="text-white">
            {theirs
              ? theirs.vote === "like"
                ? "Liked"
                : "Passed"
              : mine
                ? "Waiting"
                : "—"}
          </span>
        </span>
      )}
      {state === "mutual-match" && (
        <span className="text-emerald-400">Match</span>
      )}
    </div>
  );
}
