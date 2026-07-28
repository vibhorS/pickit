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
 * Per-movie rating presentation for collaborative UI.
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
  const partnerId = input.partnerUserId;
  const theirs = partnerId
    ? input.ratings.find(
        (r) =>
          r.collectionId === input.collectionId &&
          r.movieId === input.movieId &&
          r.userId === partnerId &&
          !r.deletedAt,
      )
    : undefined;

  if (!mine && !theirs) return "not-rated";
  if (mine && !theirs && partnerId) return "waiting-on-partner";
  if (!mine && theirs) return "partner";
  if (mine && theirs) {
    if (mine.vote === "like" && theirs.vote === "like") return "mutual-match";
    return "mismatch";
  }
  if (mine) return "yours";
  return "not-rated";
}

export function formatRatingStateLabel(state: RatingDisplayState): string {
  switch (state) {
    case "yours":
      return "Your rating";
    case "partner":
      return "Partner rated";
    case "waiting-on-partner":
      return "Waiting on partner";
    case "not-rated":
      return "Not rated";
    case "mutual-match":
      return "Mutual match";
    case "mismatch":
      return "Different picks";
  }
}

export function memberLabel(
  user: User,
  currentUserId: string,
  partnerUserId?: string | null,
): string {
  if (user.id === currentUserId) return "You";
  if (partnerUserId && user.id === partnerUserId) return "Partner";
  return user.name;
}
