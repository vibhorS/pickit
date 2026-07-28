import type {
  AppNotification,
  Collection,
  CollectionActivity,
  CollectionItem,
  CollectionMembership,
  Invitation,
  MovieVote,
  PartnerInvitation,
  PartnerRelationship,
  PendingOperation,
  PresenceState,
  UserProfile,
} from "@/lib/types";

export type RepositoryResult<T> =
  | { ok: true; data: T; fromCache?: boolean }
  | { ok: false; error: RepositoryError };

export type RepositoryErrorCode =
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NETWORK"
  | "TIMEOUT"
  | "VALIDATION"
  | "DELETED"
  | "EXPIRED_SESSION"
  | "UNKNOWN";

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;
  readonly recoverable: boolean;
  readonly cause?: unknown;

  constructor(
    code: RepositoryErrorCode,
    message: string,
    options?: { recoverable?: boolean; cause?: unknown },
  ) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
    this.recoverable = options?.recoverable ?? (code === "NETWORK" || code === "TIMEOUT");
    this.cause = options?.cause;
  }
}

export type ListQuery = {
  includeDeleted?: boolean;
  includeArchived?: boolean;
  householdId?: string;
  ownerId?: string;
  memberUserId?: string;
};

export type UserRepository = {
  getById(id: string): Promise<UserProfile | null>;
  getByEmail(email: string): Promise<UserProfile | null>;
  upsert(profile: UserProfile): Promise<UserProfile>;
  delete(id: string): Promise<void>;
  list(): Promise<UserProfile[]>;
};

export type CollectionRepository = {
  getById(id: string): Promise<Collection | null>;
  list(query?: ListQuery): Promise<Collection[]>;
  upsert(collection: Collection): Promise<Collection>;
  softDelete(id: string, userId: string): Promise<Collection | null>;
  restore(id: string, userId: string): Promise<Collection | null>;
  archive(id: string, userId: string): Promise<Collection | null>;
  unarchive(id: string, userId: string): Promise<Collection | null>;
  duplicate(id: string, userId: string): Promise<Collection | null>;
};

export type MembershipRepository = {
  listForCollection(collectionId: string): Promise<CollectionMembership[]>;
  listForUser(userId: string): Promise<CollectionMembership[]>;
  upsert(membership: CollectionMembership): Promise<CollectionMembership>;
  remove(id: string): Promise<void>;
};

export type RatingRepository = {
  listForCollection(collectionId: string): Promise<MovieVote[]>;
  listForUser(userId: string): Promise<MovieVote[]>;
  upsert(rating: MovieVote): Promise<MovieVote>;
  remove(
    collectionId: string,
    movieId: string,
    userId: string,
  ): Promise<void>;
};

export type RecommendationRepository = {
  listForCollection(collectionId: string): Promise<CollectionItem[]>;
  upsert(
    collectionId: string,
    item: CollectionItem,
  ): Promise<CollectionItem>;
  softDelete(
    collectionId: string,
    movieId: string,
    userId: string,
  ): Promise<void>;
};

export type RelationshipRepository = {
  getActiveForUser(userId: string): Promise<PartnerRelationship | null>;
  getByToken(token: string): Promise<PartnerRelationship | null>;
  getById(id: string): Promise<PartnerRelationship | null>;
  upsert(relationship: PartnerRelationship): Promise<PartnerRelationship>;
  listForUser(userId: string): Promise<PartnerRelationship[]>;
};

export type InvitationRepository = {
  listPendingForCollection(collectionId: string): Promise<Invitation[]>;
  getByToken(token: string): Promise<Invitation | null>;
  upsert(invitation: Invitation): Promise<Invitation>;
};

export type PartnerInvitationRepository = {
  getByToken(token: string): Promise<PartnerInvitation | null>;
  upsert(invitation: PartnerInvitation): Promise<PartnerInvitation>;
  listPendingForUser(userId: string): Promise<PartnerInvitation[]>;
};

export type ActivityRepository = {
  listForCollection(
    collectionId: string,
    limit?: number,
  ): Promise<CollectionActivity[]>;
  append(activity: CollectionActivity): Promise<CollectionActivity>;
};

export type NotificationRepository = {
  listForUser(userId: string): Promise<AppNotification[]>;
  upsert(notification: AppNotification): Promise<AppNotification>;
  markRead(id: string): Promise<void>;
};

export type PresenceRepository = {
  get(userId: string): Promise<PresenceState | null>;
  upsert(presence: PresenceState): Promise<PresenceState>;
  listForUsers(userIds: string[]): Promise<PresenceState[]>;
};

export type OfflineQueueRepository = {
  enqueue(operation: PendingOperation): Promise<void>;
  list(): Promise<PendingOperation[]>;
  remove(id: string): Promise<void>;
  update(operation: PendingOperation): Promise<void>;
  clear(): Promise<void>;
};

export type Repositories = {
  users: UserRepository;
  collections: CollectionRepository;
  memberships: MembershipRepository;
  ratings: RatingRepository;
  recommendations: RecommendationRepository;
  relationships: RelationshipRepository;
  invitations: InvitationRepository;
  partnerInvitations: PartnerInvitationRepository;
  activity: ActivityRepository;
  notifications: NotificationRepository;
  presence: PresenceRepository;
  offlineQueue: OfflineQueueRepository;
};
