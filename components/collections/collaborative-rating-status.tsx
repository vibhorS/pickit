"use client";

import {
  formatRatingStateLabel,
  getRatingDisplayState,
} from "@/lib/collaboration";
import { resolveCrewMemberLabel } from "@/lib/crew/member-identity";
import type { MovieVote } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";
import { useCrewStore } from "@/store/crew-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type RatingStatusProps = {
  collectionId: string;
  movieId: string;
  ratings: MovieVote[];
  compact?: boolean;
};

/** Shows your rating vs Crew member rating / waiting / mutual states. */
export function CollaborativeRatingStatus({
  collectionId,
  movieId,
  ratings,
  compact = false,
}: RatingStatusProps) {
  const profile = useAuthStore((state) => state.profile);
  const partner = useAuthStore((state) => state.partner);
  const otherMember = useCrewStore((state) =>
    profile ? state.primaryOtherMember(profile.id) : null,
  );

  if (!profile) return null;

  const otherUserId = isSupabaseConfigured()
    ? otherMember?.userId
    : partner.partner?.id;
  const otherName = isSupabaseConfigured()
    ? resolveCrewMemberLabel(otherMember?.profile)
    : (partner.partner?.displayName ?? "Partner");

  const state = getRatingDisplayState({
    movieId,
    collectionId,
    currentUserId: profile.id,
    partnerUserId: otherUserId,
    ratings,
  });

  const mine = ratings.find(
    (r) =>
      r.collectionId === collectionId &&
      r.movieId === movieId &&
      r.userId === profile.id,
  );
  const theirs =
    otherUserId &&
    ratings.find(
      (r) =>
        r.collectionId === collectionId &&
        r.movieId === movieId &&
        r.userId === otherUserId,
    );

  if (compact) {
    return (
      <span className="text-[0.65rem] text-netflix-muted">
        {formatRatingStateLabel(state, {
          mine: mine?.vote,
          theirs: theirs ? theirs.vote : undefined,
        })}
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
      {otherUserId && (
        <span>
          {otherName}:{" "}
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
        <span className="text-emerald-400">Mutual Like</span>
      )}
      {state === "mismatch" &&
        mine?.vote === "pass" &&
        theirs &&
        theirs.vote === "pass" && (
          <span className="text-netflix-muted">Mutual Dislike</span>
        )}
    </div>
  );
}
