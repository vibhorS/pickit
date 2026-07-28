import type {
  CollectionMembership,
  Invitation,
  MovieVote,
  RatingDisplayState,
  User,
} from "@/lib/types";

export type CollectionSharingState =
  | "not-shared"
  | "invitation-pending"
  | "connected";

export function getCollectionSharingState(
  collectionId: string,
  memberships: CollectionMembership[],
  invitations: Invitation[],
): CollectionSharingState {
  const memberCount = memberships.filter(
    (membership) => membership.collectionId === collectionId,
  ).length;
  if (memberCount > 1) return "connected";
  const pending = invitations.some(
    (invitation) =>
      invitation.collectionId === collectionId &&
      invitation.status === "pending",
  );
  if (pending) return "invitation-pending";
  return "not-shared";
}

/**
 * Per-movie rating presentation for collaborative Crew UI.
 * `partnerUserId` is the other Crew member (kept for API compatibility).
 */
export function getRatingDisplayState(input: {
  movieId: string;
  collectionId: string;
  currentUserId: string;
  partnerUserId?: string | null;
  ratings: MovieVote[];
}): RatingDisplayState {
  const mine = input.ratings.find(
    (r) =>
      r.collectionId === input.collectionId &&
      r.movieId === input.movieId &&
      r.userId === input.currentUserId &&
      !r.deletedAt,
  );
  const otherId = input.partnerUserId;
  const theirs = otherId
    ? input.ratings.find(
        (r) =>
          r.collectionId === input.collectionId &&
          r.movieId === input.movieId &&
          r.userId === otherId &&
          !r.deletedAt,
      )
    : undefined;

  if (!mine && !theirs) return "not-rated";
  if (mine && !theirs && otherId) return "waiting-on-partner";
  if (!mine && theirs) return "partner";
  if (mine && theirs) {
    if (mine.vote === "like" && theirs.vote === "like") return "mutual-match";
    if (mine.vote === "pass" && theirs.vote === "pass") return "mismatch";
    return "mismatch";
  }
  if (mine) return "yours";
  return "not-rated";
}

export function formatRatingStateLabel(
  state: RatingDisplayState,
  votes?: { mine?: "like" | "pass"; theirs?: "like" | "pass" },
): string {
  switch (state) {
    case "yours":
      return "Your rating";
    case "partner":
      return "Crew member rated";
    case "waiting-on-partner":
      return "Waiting";
    case "not-rated":
      return "Not rated";
    case "mutual-match":
      return "Mutual Like";
    case "mismatch":
      if (votes?.mine === "pass" && votes?.theirs === "pass") {
        return "Mutual Dislike";
      }
      return "Different picks";
  }
}

export function memberLabel(
  user: User,
  currentUserId: string,
  partnerUserId?: string | null,
): string {
  if (user.id === currentUserId) return "You";
  if (partnerUserId && user.id === partnerUserId) return user.name;
  return user.name;
}
