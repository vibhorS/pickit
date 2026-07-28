/**
 * Domain event definitions for notifications and future push providers.
 * Keep payloads serializable and provider-agnostic.
 */

export type DomainEventType =
  | "partner.joined"
  | "partner.disconnected"
  | "partner.invite.sent"
  | "partner.invite.declined"
  | "partner.invite.cancelled"
  | "recommendation.added"
  | "recommendation.removed"
  | "movie.rated"
  | "movie-night.ready"
  | "movie-night.completed"
  | "list.shared"
  | "list.created"
  | "list.archived"
  | "list.restored"
  | "presence.updated"
  | "sync.conflict"
  | "auth.session.expired";

export type DomainEventBase<T extends DomainEventType, P> = {
  id: string;
  type: T;
  occurredAt: string;
  actorUserId: string;
  householdId?: string;
  collectionId?: string;
  payload: P;
};

export type PartnerJoinedEvent = DomainEventBase<
  "partner.joined",
  { partnerUserId: string; relationshipId: string }
>;

export type PartnerDisconnectedEvent = DomainEventBase<
  "partner.disconnected",
  { partnerUserId: string; relationshipId: string }
>;

export type PartnerInviteSentEvent = DomainEventBase<
  "partner.invite.sent",
  { invitationId: string; token: string }
>;

export type PartnerInviteDeclinedEvent = DomainEventBase<
  "partner.invite.declined",
  { invitationId: string }
>;

export type PartnerInviteCancelledEvent = DomainEventBase<
  "partner.invite.cancelled",
  { invitationId: string }
>;

export type RecommendationAddedEvent = DomainEventBase<
  "recommendation.added",
  { movieId: string; note?: string; sourceLabel?: string }
>;

export type RecommendationRemovedEvent = DomainEventBase<
  "recommendation.removed",
  { movieId: string }
>;

export type MovieRatedEvent = DomainEventBase<
  "movie.rated",
  { movieId: string; vote: "like" | "pass" }
>;

export type MovieNightReadyEvent = DomainEventBase<
  "movie-night.ready",
  { mutualMatchCount: number }
>;

export type MovieNightCompletedEvent = DomainEventBase<
  "movie-night.completed",
  { winnerMovieId?: string; gameId?: string }
>;

export type ListSharedEvent = DomainEventBase<
  "list.shared",
  { memberUserIds: string[] }
>;

export type ListCreatedEvent = DomainEventBase<
  "list.created",
  { name: string }
>;

export type ListArchivedEvent = DomainEventBase<"list.archived", Record<string, never>>;

export type ListRestoredEvent = DomainEventBase<"list.restored", Record<string, never>>;

export type PresenceUpdatedEvent = DomainEventBase<
  "presence.updated",
  {
    status: "online" | "recently-active" | "rating" | "updating-list" | "offline";
    collectionId?: string;
  }
>;

export type SyncConflictEvent = DomainEventBase<
  "sync.conflict",
  { entityType: string; entityId: string; resolution: string }
>;

export type AuthSessionExpiredEvent = DomainEventBase<
  "auth.session.expired",
  { reason: string }
>;

export type DomainEvent =
  | PartnerJoinedEvent
  | PartnerDisconnectedEvent
  | PartnerInviteSentEvent
  | PartnerInviteDeclinedEvent
  | PartnerInviteCancelledEvent
  | RecommendationAddedEvent
  | RecommendationRemovedEvent
  | MovieRatedEvent
  | MovieNightReadyEvent
  | MovieNightCompletedEvent
  | ListSharedEvent
  | ListCreatedEvent
  | ListArchivedEvent
  | ListRestoredEvent
  | PresenceUpdatedEvent
  | SyncConflictEvent
  | AuthSessionExpiredEvent;

export type NotificationChannel = "in-app" | "push" | "email";

/** Future push providers plug in by implementing this adapter. */
export type NotificationDispatcher = {
  dispatch(
    event: DomainEvent,
    channels: NotificationChannel[],
  ): Promise<void>;
};
