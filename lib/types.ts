import type { AuditFields } from "@/lib/domain/audit";

// ======================
// Movie
// ======================

export type MediaType = "movie" | "tv" | "documentary" | "youtube";

export type Movie = {
  id: string;
  title: string;
  year: number;
  runtime: number;
  rating: number;
  genres: string[];
  overview: string;
  posterUrl: string;
  /** Content kind. Only "movie" is used in the UI today. */
  mediaType: MediaType;
};

// ======================
// User / Profile
// ======================

export type AuthProvider =
  | "email"
  | "google"
  | "apple"
  | "guest"
  | "local";

export type UserProfile = {
  id: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  /** Accent used in collaborative UI. */
  color: string;
  provider: AuthProvider;
  isGuest: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Compatibility alias used throughout existing UI.
 * Prefer UserProfile for new code.
 */
export type User = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  color?: string;
};

export function profileToUser(profile: UserProfile): User {
  return {
    id: profile.id,
    name: profile.displayName,
    email: profile.email ?? undefined,
    avatarUrl: profile.avatarUrl ?? undefined,
    color: profile.color,
  };
}

export function userToProfile(
  user: User,
  extras?: Partial<UserProfile>,
): UserProfile {
  const now = new Date().toISOString();
  return {
    id: user.id,
    displayName: user.name,
    email: user.email ?? null,
    avatarUrl: user.avatarUrl ?? null,
    color: user.color ?? "#e50914",
    provider: extras?.provider ?? "local",
    isGuest: extras?.isGuest ?? false,
    createdAt: extras?.createdAt ?? now,
    updatedAt: extras?.updatedAt ?? now,
  };
}

// ======================
// Household / Partner
// ======================

/**
 * Household is the future multi-member unit.
 * MVP uses a 2-person household formed by a PartnerRelationship.
 */
export type Household = AuditFields & {
  id: string;
  name: string;
};

export type PartnerRelationshipStatus =
  | "invite-pending"
  | "invitation-received"
  | "connected"
  | "disconnected";

/**
 * One active partner per user for MVP.
 * Designed so multiple households can be supported later.
 */
export type PartnerRelationship = AuditFields & {
  id: string;
  householdId: string;
  /** User who initiated the relationship / invite. */
  inviterUserId: string;
  /** Partner user once accepted; null while invite is pending. */
  partnerUserId: string | null;
  status: "pending" | "connected" | "declined" | "cancelled" | "disconnected";
  inviteToken: string;
  acceptedAt?: string | null;
  disconnectedAt?: string | null;
};

export type PartnerUiState =
  | "no-partner"
  | "invite-pending"
  | "invitation-received"
  | "connected";

export type PartnerSnapshot = {
  state: PartnerUiState;
  relationship: PartnerRelationship | null;
  partner: UserProfile | null;
  outgoingInvite: PartnerInvitation | null;
  incomingByToken?: string;
};

// ======================
// Membership / Roles
// ======================

export type MembershipRole = "owner" | "partner" | "member";

export type CollectionMembership = {
  id: string;
  collectionId: string;
  userId: string;
  role: MembershipRole;
  joinedAt: string;
} & Partial<AuditFields>;

export type InvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "revoked"
  | "cancelled";

/** Collection-scoped invite (share a list). */
export type Invitation = {
  id: string;
  collectionId: string;
  invitedByUserId: string;
  token: string;
  status: InvitationStatus;
  createdAt: string;
  acceptedAt?: string;
  acceptedByUserId?: string;
  declinedAt?: string;
};

/** Partner-scoped invite (form a household). */
export type PartnerInvitation = {
  id: string;
  relationshipId: string;
  invitedByUserId: string;
  token: string;
  status: InvitationStatus;
  createdAt: string;
  acceptedAt?: string;
  acceptedByUserId?: string;
  declinedAt?: string;
};

// ======================
// Notifications / Activity / Presence
// ======================

export type NotificationType =
  | "invitation-accepted"
  | "invitation-received"
  | "partner-joined"
  | "partner-disconnected"
  | "recommendation-added"
  | "recommendation-removed"
  | "movie-rated"
  | "ratings-complete"
  | "movie-night-ready"
  | "list-shared"
  | "sync-error";

export type AppNotification = {
  id: string;
  userId: string;
  collectionId?: string;
  type: NotificationType;
  message: string;
  createdAt: string;
  readAt?: string;
  eventId?: string;
};

export type CollectionActivityType =
  | "movie-added"
  | "movie-rated"
  | "ratings-completed"
  | "movie-night-completed"
  | "list-created"
  | "list-shared"
  | "partner-joined"
  | "recommendation-removed";

export type CollectionActivity = {
  id: string;
  collectionId: string;
  userId: string;
  type: CollectionActivityType;
  movieId?: string;
  occurredAt: string;
  summary?: string;
};

export type PresenceStatus =
  | "online"
  | "recently-active"
  | "rating"
  | "updating-list"
  | "offline";

export type PresenceState = {
  userId: string;
  status: PresenceStatus;
  collectionId?: string;
  updatedAt: string;
};

// ======================
// Bucket
// ======================

export type BucketItem = {
  movie: Movie;
  addedBy: string;
  addedAt: Date;
};

// ======================
// Recommendation source
// ======================

export type RecommendationSource = {
  type: string;
  label: string;
};

export type RecommendationMetadata = {
  sourcePlatform?: string;
  sourceUrl?: string;
  recommendedBy?: string;
  savedAt?: string;
  notes?: string;
  captureMethod?: string;
};

export type CollectionItem = {
  movieId: string;
  source: RecommendationSource;
  metadata?: RecommendationMetadata;
  /** PickIt member who saved this recommendation. */
  addedByUserId?: string;
  addedAt?: string;
  note?: string;
  updatedBy?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

// ======================
// Collection (List)
// ======================

export type CollectionPermission = "owner" | "partner" | "member" | "viewer";

export type Collection = {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  items: CollectionItem[];
  ownerId?: string;
  householdId?: string | null;
  archivedAt?: string | null;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

// ======================
// Movie Vote / Rating
// ======================

export type VoteValue = "like" | "pass";

export type MovieVote = {
  collectionId: string;
  movieId: string;
  userId: string;
  vote: VoteValue;
  votedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

/** User-owned collection rating. MovieVote remains as a compatibility name. */
export type Rating = MovieVote;

export type RatingDisplayState =
  | "yours"
  | "partner"
  | "waiting-on-partner"
  | "not-rated"
  | "mutual-match"
  | "mismatch";

// ======================
// Sync
// ======================

export type SyncStatus =
  | "idle"
  | "syncing"
  | "offline"
  | "error"
  | "conflict";

export type PendingOperationType =
  | "upsert"
  | "delete"
  | "soft-delete"
  | "restore";

export type PendingOperation = {
  id: string;
  entityType:
    | "user"
    | "collection"
    | "membership"
    | "rating"
    | "recommendation"
    | "relationship"
    | "invitation"
    | "activity"
    | "notification"
    | "presence";
  entityId: string;
  operation: PendingOperationType;
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastError?: string;
  nextRetryAt?: string;
};
