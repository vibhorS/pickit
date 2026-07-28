import { stampUpdate } from "@/lib/domain/audit";
import {
  broadcastChange,
  createId,
  readJson,
  writeJson,
} from "@/lib/repositories/local/storage";
import type {
  ActivityRepository,
  CollectionRepository,
  InvitationRepository,
  MembershipRepository,
  NotificationRepository,
  OfflineQueueRepository,
  PartnerInvitationRepository,
  PresenceRepository,
  RatingRepository,
  RecommendationRepository,
  RelationshipRepository,
  Repositories,
  UserRepository,
} from "@/lib/repositories/types";
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

const TABLES = {
  users: "users",
  collections: "collections",
  memberships: "memberships",
  ratings: "ratings",
  relationships: "relationships",
  invitations: "invitations",
  partnerInvitations: "partner-invitations",
  activity: "activity",
  notifications: "notifications",
  presence: "presence",
  offlineQueue: "offline-queue",
} as const;

function reviveRating(rating: MovieVote): MovieVote {
  return {
    ...rating,
    votedAt: new Date(rating.votedAt),
  };
}

function createUserRepository(): UserRepository {
  return {
    async getById(id) {
      return readJson<UserProfile[]>(TABLES.users, []).find((u) => u.id === id) ?? null;
    },
    async getByEmail(email) {
      const normalized = email.trim().toLowerCase();
      return (
        readJson<UserProfile[]>(TABLES.users, []).find(
          (u) => u.email?.toLowerCase() === normalized,
        ) ?? null
      );
    },
    async upsert(profile) {
      const users = readJson<UserProfile[]>(TABLES.users, []);
      const index = users.findIndex((u) => u.id === profile.id);
      if (index >= 0) users[index] = profile;
      else users.push(profile);
      writeJson(TABLES.users, users);
      broadcastChange("users");
      return profile;
    },
    async delete(id) {
      writeJson(
        TABLES.users,
        readJson<UserProfile[]>(TABLES.users, []).filter((u) => u.id !== id),
      );
      broadcastChange("users");
    },
    async list() {
      return readJson<UserProfile[]>(TABLES.users, []);
    },
  };
}

function createCollectionRepository(): CollectionRepository {
  return {
    async getById(id) {
      return (
        readJson<Collection[]>(TABLES.collections, []).find((c) => c.id === id) ??
        null
      );
    },
    async list(query) {
      let collections = readJson<Collection[]>(TABLES.collections, []);
      if (!query?.includeDeleted) {
        collections = collections.filter((c) => !c.deletedAt);
      }
      if (!query?.includeArchived) {
        collections = collections.filter((c) => !c.archivedAt);
      }
      if (query?.householdId) {
        collections = collections.filter(
          (c) => c.householdId === query.householdId,
        );
      }
      if (query?.ownerId) {
        collections = collections.filter((c) => c.ownerId === query.ownerId);
      }
      return collections;
    },
    async upsert(collection) {
      const collections = readJson<Collection[]>(TABLES.collections, []);
      const index = collections.findIndex((c) => c.id === collection.id);
      if (index >= 0) collections[index] = collection;
      else collections.push(collection);
      writeJson(TABLES.collections, collections);
      broadcastChange("collections");
      return collection;
    },
    async softDelete(id, userId) {
      const collections = readJson<Collection[]>(TABLES.collections, []);
      const index = collections.findIndex((c) => c.id === id);
      if (index < 0) return null;
      collections[index] = {
        ...collections[index],
        ...stampUpdate(userId),
        deletedAt: new Date().toISOString(),
      };
      writeJson(TABLES.collections, collections);
      broadcastChange("collections");
      return collections[index];
    },
    async restore(id, userId) {
      const collections = readJson<Collection[]>(TABLES.collections, []);
      const index = collections.findIndex((c) => c.id === id);
      if (index < 0) return null;
      collections[index] = {
        ...collections[index],
        ...stampUpdate(userId),
        deletedAt: null,
      };
      writeJson(TABLES.collections, collections);
      broadcastChange("collections");
      return collections[index];
    },
    async archive(id, userId) {
      const collections = readJson<Collection[]>(TABLES.collections, []);
      const index = collections.findIndex((c) => c.id === id);
      if (index < 0) return null;
      collections[index] = {
        ...collections[index],
        ...stampUpdate(userId),
        archivedAt: new Date().toISOString(),
      };
      writeJson(TABLES.collections, collections);
      broadcastChange("collections");
      return collections[index];
    },
    async unarchive(id, userId) {
      const collections = readJson<Collection[]>(TABLES.collections, []);
      const index = collections.findIndex((c) => c.id === id);
      if (index < 0) return null;
      collections[index] = {
        ...collections[index],
        ...stampUpdate(userId),
        archivedAt: null,
      };
      writeJson(TABLES.collections, collections);
      broadcastChange("collections");
      return collections[index];
    },
    async duplicate(id, userId) {
      const source = await this.getById(id);
      if (!source || source.deletedAt) return null;
      const now = new Date().toISOString();
      const copy: Collection = {
        ...source,
        id: createId("collection"),
        name: `${source.name} Copy`,
        ownerId: userId,
        createdBy: userId,
        updatedBy: userId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        archivedAt: null,
        items: source.items
          .filter((item) => !item.deletedAt)
          .map((item) => ({
            ...item,
            addedByUserId: userId,
            addedAt: now,
            updatedBy: userId,
            updatedAt: now,
          })),
      };
      return this.upsert(copy);
    },
  };
}

function createMembershipRepository(): MembershipRepository {
  return {
    async listForCollection(collectionId) {
      return readJson<CollectionMembership[]>(TABLES.memberships, []).filter(
        (m) => m.collectionId === collectionId,
      );
    },
    async listForUser(userId) {
      return readJson<CollectionMembership[]>(TABLES.memberships, []).filter(
        (m) => m.userId === userId,
      );
    },
    async upsert(membership) {
      const memberships = readJson<CollectionMembership[]>(
        TABLES.memberships,
        [],
      );
      const index = memberships.findIndex((m) => m.id === membership.id);
      if (index >= 0) memberships[index] = membership;
      else {
        const existing = memberships.findIndex(
          (m) =>
            m.collectionId === membership.collectionId &&
            m.userId === membership.userId,
        );
        if (existing >= 0) memberships[existing] = membership;
        else memberships.push(membership);
      }
      writeJson(TABLES.memberships, memberships);
      broadcastChange("memberships");
      return membership;
    },
    async remove(id) {
      writeJson(
        TABLES.memberships,
        readJson<CollectionMembership[]>(TABLES.memberships, []).filter(
          (m) => m.id !== id,
        ),
      );
      broadcastChange("memberships");
    },
  };
}

function createRatingRepository(): RatingRepository {
  return {
    async listForCollection(collectionId) {
      return readJson<MovieVote[]>(TABLES.ratings, [])
        .filter((r) => r.collectionId === collectionId && !r.deletedAt)
        .map(reviveRating);
    },
    async listForUser(userId) {
      return readJson<MovieVote[]>(TABLES.ratings, [])
        .filter((r) => r.userId === userId && !r.deletedAt)
        .map(reviveRating);
    },
    async upsert(rating) {
      const ratings = readJson<MovieVote[]>(TABLES.ratings, []);
      const index = ratings.findIndex(
        (r) =>
          r.collectionId === rating.collectionId &&
          r.movieId === rating.movieId &&
          r.userId === rating.userId,
      );
      const next = {
        ...rating,
        votedAt: new Date(rating.votedAt).toISOString(),
      } as unknown as MovieVote;
      if (index >= 0) ratings[index] = next;
      else ratings.push(next);
      writeJson(TABLES.ratings, ratings);
      broadcastChange("ratings");
      return reviveRating({
        ...rating,
        votedAt: new Date(rating.votedAt),
      });
    },
    async remove(collectionId, movieId, userId) {
      const ratings = readJson<MovieVote[]>(TABLES.ratings, []);
      writeJson(
        TABLES.ratings,
        ratings.filter(
          (r) =>
            !(
              r.collectionId === collectionId &&
              r.movieId === movieId &&
              r.userId === userId
            ),
        ),
      );
      broadcastChange("ratings");
    },
  };
}

function createRecommendationRepository(): RecommendationRepository {
  return {
    async listForCollection(collectionId) {
      const collection = readJson<Collection[]>(TABLES.collections, []).find(
        (c) => c.id === collectionId,
      );
      return (collection?.items ?? []).filter((item) => !item.deletedAt);
    },
    async upsert(collectionId, item) {
      const collections = readJson<Collection[]>(TABLES.collections, []);
      const index = collections.findIndex((c) => c.id === collectionId);
      if (index < 0) return item;
      const items = [...(collections[index].items ?? [])];
      const itemIndex = items.findIndex((entry) => entry.movieId === item.movieId);
      if (itemIndex >= 0) items[itemIndex] = item;
      else items.push(item);
      collections[index] = { ...collections[index], items };
      writeJson(TABLES.collections, collections);
      broadcastChange("collections");
      return item;
    },
    async softDelete(collectionId, movieId, userId) {
      const collections = readJson<Collection[]>(TABLES.collections, []);
      const index = collections.findIndex((c) => c.id === collectionId);
      if (index < 0) return;
      const now = new Date().toISOString();
      collections[index] = {
        ...collections[index],
        items: collections[index].items.map((item) =>
          item.movieId === movieId
            ? {
                ...item,
                deletedAt: now,
                updatedAt: now,
                updatedBy: userId,
              }
            : item,
        ),
      };
      writeJson(TABLES.collections, collections);
      broadcastChange("collections");
    },
  };
}

function createRelationshipRepository(): RelationshipRepository {
  return {
    async getActiveForUser(userId) {
      const relationships = readJson<PartnerRelationship[]>(
        TABLES.relationships,
        [],
      );
      return (
        relationships.find(
          (r) =>
            !r.deletedAt &&
            (r.status === "connected" || r.status === "pending") &&
            (r.inviterUserId === userId || r.partnerUserId === userId),
        ) ?? null
      );
    },
    async getByToken(token) {
      return (
        readJson<PartnerRelationship[]>(TABLES.relationships, []).find(
          (r) => r.inviteToken === token && !r.deletedAt,
        ) ?? null
      );
    },
    async getById(id) {
      return (
        readJson<PartnerRelationship[]>(TABLES.relationships, []).find(
          (r) => r.id === id,
        ) ?? null
      );
    },
    async upsert(relationship) {
      const relationships = readJson<PartnerRelationship[]>(
        TABLES.relationships,
        [],
      );
      const index = relationships.findIndex((r) => r.id === relationship.id);
      if (index >= 0) relationships[index] = relationship;
      else relationships.push(relationship);
      writeJson(TABLES.relationships, relationships);
      broadcastChange("relationships");
      return relationship;
    },
    async listForUser(userId) {
      return readJson<PartnerRelationship[]>(TABLES.relationships, []).filter(
        (r) =>
          r.inviterUserId === userId || r.partnerUserId === userId,
      );
    },
  };
}

function createInvitationRepository(): InvitationRepository {
  return {
    async listPendingForCollection(collectionId) {
      return readJson<Invitation[]>(TABLES.invitations, []).filter(
        (i) => i.collectionId === collectionId && i.status === "pending",
      );
    },
    async getByToken(token) {
      return (
        readJson<Invitation[]>(TABLES.invitations, []).find(
          (i) => i.token === token,
        ) ?? null
      );
    },
    async upsert(invitation) {
      const invitations = readJson<Invitation[]>(TABLES.invitations, []);
      const index = invitations.findIndex((i) => i.id === invitation.id);
      if (index >= 0) invitations[index] = invitation;
      else invitations.push(invitation);
      writeJson(TABLES.invitations, invitations);
      broadcastChange("invitations");
      return invitation;
    },
  };
}

function createPartnerInvitationRepository(): PartnerInvitationRepository {
  return {
    async getByToken(token) {
      return (
        readJson<PartnerInvitation[]>(TABLES.partnerInvitations, []).find(
          (i) => i.token === token,
        ) ?? null
      );
    },
    async upsert(invitation) {
      const invitations = readJson<PartnerInvitation[]>(
        TABLES.partnerInvitations,
        [],
      );
      const index = invitations.findIndex((i) => i.id === invitation.id);
      if (index >= 0) invitations[index] = invitation;
      else invitations.push(invitation);
      writeJson(TABLES.partnerInvitations, invitations);
      broadcastChange("partner-invitations");
      return invitation;
    },
    async listPendingForUser(userId) {
      // Partner invites are token-based; pending list is for inviter tracking.
      return readJson<PartnerInvitation[]>(TABLES.partnerInvitations, []).filter(
        (i) => i.invitedByUserId === userId && i.status === "pending",
      );
    },
  };
}

function createActivityRepository(): ActivityRepository {
  return {
    async listForCollection(collectionId, limit = 50) {
      return readJson<CollectionActivity[]>(TABLES.activity, [])
        .filter((a) => a.collectionId === collectionId)
        .slice(0, limit);
    },
    async append(activity) {
      const activityList = [
        activity,
        ...readJson<CollectionActivity[]>(TABLES.activity, []),
      ].slice(0, 500);
      writeJson(TABLES.activity, activityList);
      broadcastChange("activity");
      return activity;
    },
  };
}

function createNotificationRepository(): NotificationRepository {
  return {
    async listForUser(userId) {
      return readJson<AppNotification[]>(TABLES.notifications, []).filter(
        (n) => n.userId === userId,
      );
    },
    async upsert(notification) {
      const notifications = readJson<AppNotification[]>(
        TABLES.notifications,
        [],
      );
      const index = notifications.findIndex((n) => n.id === notification.id);
      if (index >= 0) notifications[index] = notification;
      else notifications.unshift(notification);
      writeJson(TABLES.notifications, notifications.slice(0, 200));
      broadcastChange("notifications");
      return notification;
    },
    async markRead(id) {
      const notifications = readJson<AppNotification[]>(
        TABLES.notifications,
        [],
      );
      const index = notifications.findIndex((n) => n.id === id);
      if (index < 0) return;
      notifications[index] = {
        ...notifications[index],
        readAt: new Date().toISOString(),
      };
      writeJson(TABLES.notifications, notifications);
      broadcastChange("notifications");
    },
  };
}

function createPresenceRepository(): PresenceRepository {
  return {
    async get(userId) {
      return (
        readJson<PresenceState[]>(TABLES.presence, []).find(
          (p) => p.userId === userId,
        ) ?? null
      );
    },
    async upsert(presence) {
      const presenceList = readJson<PresenceState[]>(TABLES.presence, []);
      const index = presenceList.findIndex((p) => p.userId === presence.userId);
      if (index >= 0) presenceList[index] = presence;
      else presenceList.push(presence);
      writeJson(TABLES.presence, presenceList);
      broadcastChange("presence");
      return presence;
    },
    async listForUsers(userIds) {
      const set = new Set(userIds);
      return readJson<PresenceState[]>(TABLES.presence, []).filter((p) =>
        set.has(p.userId),
      );
    },
  };
}

function createOfflineQueueRepository(): OfflineQueueRepository {
  return {
    async enqueue(operation) {
      const queue = readJson<PendingOperation[]>(TABLES.offlineQueue, []);
      queue.push(operation);
      writeJson(TABLES.offlineQueue, queue);
      broadcastChange("offline-queue");
    },
    async list() {
      return readJson<PendingOperation[]>(TABLES.offlineQueue, []);
    },
    async remove(id) {
      writeJson(
        TABLES.offlineQueue,
        readJson<PendingOperation[]>(TABLES.offlineQueue, []).filter(
          (op) => op.id !== id,
        ),
      );
      broadcastChange("offline-queue");
    },
    async update(operation) {
      const queue = readJson<PendingOperation[]>(TABLES.offlineQueue, []);
      const index = queue.findIndex((op) => op.id === operation.id);
      if (index >= 0) queue[index] = operation;
      writeJson(TABLES.offlineQueue, queue);
      broadcastChange("offline-queue");
    },
    async clear() {
      writeJson(TABLES.offlineQueue, []);
      broadcastChange("offline-queue");
    },
  };
}

let cached: Repositories | null = null;

/** Local-first repositories. Swap for Supabase implementations when configured. */
export function getLocalRepositories(): Repositories {
  if (cached) return cached;
  cached = {
    users: createUserRepository(),
    collections: createCollectionRepository(),
    memberships: createMembershipRepository(),
    ratings: createRatingRepository(),
    recommendations: createRecommendationRepository(),
    relationships: createRelationshipRepository(),
    invitations: createInvitationRepository(),
    partnerInvitations: createPartnerInvitationRepository(),
    activity: createActivityRepository(),
    notifications: createNotificationRepository(),
    presence: createPresenceRepository(),
    offlineQueue: createOfflineQueueRepository(),
  };
  return cached;
}

export { createId };
