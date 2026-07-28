import { createEventId, domainEventBus } from "@/lib/events/bus";
import { getRepositories } from "@/lib/repositories/index";
import { createId } from "@/lib/repositories/local";
import type {
  AppNotification,
  NotificationType,
  PresenceState,
  PresenceStatus,
} from "@/lib/types";
import type { DomainEvent } from "@/lib/domain/events";

function messageForEvent(event: DomainEvent): {
  type: NotificationType;
  message: string;
  userIds: string[];
  collectionId?: string;
} | null {
  switch (event.type) {
    case "partner.joined":
      return {
        type: "partner-joined",
        message: "Your partner joined PickIt.",
        userIds: [event.actorUserId, event.payload.partnerUserId],
        collectionId: event.collectionId,
      };
    case "partner.disconnected":
      return {
        type: "partner-disconnected",
        message: "Partner connection ended.",
        userIds: [event.actorUserId, event.payload.partnerUserId],
      };
    case "partner.invite.sent":
      return {
        type: "invitation-received",
        message: "Partner invite sent.",
        userIds: [event.actorUserId],
      };
    case "recommendation.added":
      return {
        type: "recommendation-added",
        message: "A new recommendation was added.",
        userIds: [],
        collectionId: event.collectionId,
      };
    case "recommendation.removed":
      return {
        type: "recommendation-removed",
        message: "A recommendation was removed.",
        userIds: [],
        collectionId: event.collectionId,
      };
    case "movie.rated":
      return {
        type: "movie-rated",
        message: "A movie was rated.",
        userIds: [],
        collectionId: event.collectionId,
      };
    case "movie-night.ready":
      return {
        type: "movie-night-ready",
        message: "Movie Night is ready.",
        userIds: [],
        collectionId: event.collectionId,
      };
    case "list.shared":
      return {
        type: "list-shared",
        message: "A list was shared with you.",
        userIds: event.payload.memberUserIds,
        collectionId: event.collectionId,
      };
    default:
      return null;
  }
}

/**
 * Notification infrastructure (in-app).
 * Push providers plug in via NotificationDispatcher later.
 */
export class NotificationService {
  private unsub: (() => void) | null = null;

  start(): void {
    if (this.unsub) return;
    this.unsub = domainEventBus.subscribe((event) => {
      void this.handleEvent(event);
    });
  }

  stop(): void {
    this.unsub?.();
    this.unsub = null;
  }

  async listForUser(userId: string): Promise<AppNotification[]> {
    return getRepositories().notifications.listForUser(userId);
  }

  async markRead(id: string): Promise<void> {
    await getRepositories().notifications.markRead(id);
  }

  async notify(input: {
    userId: string;
    type: NotificationType;
    message: string;
    collectionId?: string;
    eventId?: string;
  }): Promise<AppNotification> {
    return getRepositories().notifications.upsert({
      id: createId("notification"),
      userId: input.userId,
      type: input.type,
      message: input.message,
      collectionId: input.collectionId,
      eventId: input.eventId,
      createdAt: new Date().toISOString(),
    });
  }

  private async handleEvent(event: DomainEvent): Promise<void> {
    const mapped = messageForEvent(event);
    if (!mapped) return;

    const recipientIds = new Set(mapped.userIds.filter(Boolean));
    // Prefer notifying the other party, not only the actor.
    recipientIds.delete(event.actorUserId);

    if (recipientIds.size === 0 && mapped.collectionId) {
      const members = await getRepositories().memberships.listForCollection(
        mapped.collectionId,
      );
      for (const member of members) {
        if (member.userId !== event.actorUserId) {
          recipientIds.add(member.userId);
        }
      }
    }

    for (const userId of recipientIds) {
      await this.notify({
        userId,
        type: mapped.type,
        message: mapped.message,
        collectionId: mapped.collectionId,
        eventId: event.id,
      });
    }
  }
}

export const notificationService = new NotificationService();

const RECENTLY_ACTIVE_MS = 5 * 60 * 1000;

export class PresenceService {
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private userId: string | null = null;

  start(userId: string): void {
    this.userId = userId;
    void this.setStatus("online");
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      void this.setStatus("online");
    }, 30_000);

    if (typeof window !== "undefined") {
      const onHide = () => void this.setStatus("recently-active");
      const onShow = () => void this.setStatus("online");
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") onHide();
        else onShow();
      });
    }
  }

  stop(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    if (this.userId) {
      void this.setStatus("offline");
    }
    this.userId = null;
  }

  async setStatus(
    status: PresenceStatus,
    collectionId?: string,
  ): Promise<PresenceState | null> {
    if (!this.userId) return null;
    const presence: PresenceState = {
      userId: this.userId,
      status,
      collectionId,
      updatedAt: new Date().toISOString(),
    };
    const saved = await getRepositories().presence.upsert(presence);
    domainEventBus.publish({
      id: createEventId(),
      type: "presence.updated",
      occurredAt: presence.updatedAt,
      actorUserId: this.userId,
      collectionId,
      payload: { status, collectionId },
    });
    return saved;
  }

  async getForUser(userId: string): Promise<PresenceState | null> {
    const presence = await getRepositories().presence.get(userId);
    if (!presence) return null;
    const age = Date.now() - new Date(presence.updatedAt).getTime();
    if (presence.status === "online" && age > RECENTLY_ACTIVE_MS) {
      return { ...presence, status: "recently-active" };
    }
    if (age > RECENTLY_ACTIVE_MS * 3) {
      return { ...presence, status: "offline" };
    }
    return presence;
  }

  async listForUsers(userIds: string[]): Promise<PresenceState[]> {
    const results = await Promise.all(
      userIds.map((id) => this.getForUser(id)),
    );
    return results.filter((entry): entry is PresenceState => Boolean(entry));
  }
}

export const presenceService = new PresenceService();
