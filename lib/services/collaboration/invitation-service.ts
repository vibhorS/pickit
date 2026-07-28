import { stampCreate, stampUpdate } from "@/lib/domain/audit";
import { createEventId, domainEventBus } from "@/lib/events/bus";
import { getRepositories } from "@/lib/repositories/index";
import { createId } from "@/lib/repositories/local";
import { can } from "@/lib/services/collaboration/permissions";
import { syncEngine } from "@/lib/sync/sync-engine";
import type { Collection, Invitation } from "@/lib/types";

/**
 * Collection invitation service (share a list).
 * Partner invites live in RelationshipService.
 */
export class InvitationService {
  async createCollectionInvite(
    collectionId: string,
    userId: string,
  ): Promise<Invitation | null> {
    const repos = getRepositories();
    const memberships = await repos.memberships.listForCollection(collectionId);
    const collection = await repos.collections.getById(collectionId);

    if (
      !can("list.invite", {
        userId,
        collection,
        memberships,
      })
    ) {
      return null;
    }

    const existing = (
      await repos.invitations.listPendingForCollection(collectionId)
    )[0];
    if (existing) return existing;

    const invitation: Invitation = {
      id: createId("invitation"),
      collectionId,
      invitedByUserId: userId,
      token: createId("join"),
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    await syncEngine.optimisticMutate(
      () => repos.invitations.upsert(invitation),
      {
        entityType: "invitation",
        entityId: invitation.id,
        operation: "upsert",
        payload: invitation,
      },
    );

    return invitation;
  }

  async acceptCollectionInvite(
    token: string,
    userId: string,
  ): Promise<Collection | null> {
    const repos = getRepositories();
    const invitation = await repos.invitations.getByToken(token);
    if (!invitation || invitation.status !== "pending") return null;

    const already = (await repos.memberships.listForCollection(
      invitation.collectionId,
    )).some((m) => m.userId === userId);
    if (already) return repos.collections.getById(invitation.collectionId);

    const now = new Date().toISOString();
    await syncEngine.optimisticMutate(
      async () => {
        await repos.memberships.upsert({
          id: createId("membership"),
          collectionId: invitation.collectionId,
          userId,
          role: "member",
          joinedAt: now,
          ...stampCreate(userId, now),
        });
        await repos.invitations.upsert({
          ...invitation,
          status: "accepted",
          acceptedAt: now,
          acceptedByUserId: userId,
        });
      },
      {
        entityType: "membership",
        entityId: `${invitation.collectionId}:${userId}`,
        operation: "upsert",
        payload: { token, userId },
      },
    );

    domainEventBus.publish({
      id: createEventId(),
      type: "list.shared",
      occurredAt: now,
      actorUserId: userId,
      collectionId: invitation.collectionId,
      payload: { memberUserIds: [invitation.invitedByUserId] },
    });

    return repos.collections.getById(invitation.collectionId);
  }

  async declineCollectionInvite(token: string, userId: string): Promise<void> {
    const repos = getRepositories();
    const invitation = await repos.invitations.getByToken(token);
    if (!invitation || invitation.status !== "pending") return;
    await repos.invitations.upsert({
      ...invitation,
      status: "declined",
      declinedAt: new Date().toISOString(),
    });
    void userId;
  }

  async revokeCollectionInvite(
    invitationId: string,
    userId: string,
  ): Promise<void> {
    const repos = getRepositories();
    const all = await repos.invitations.listPendingForCollection("");
    void all;
    // Lookup via token scan is not ideal; store full list in local repo.
    const pending = readAllInvitations().find((i) => i.id === invitationId);
    if (!pending) return;
    const memberships = await repos.memberships.listForCollection(
      pending.collectionId,
    );
    if (
      !can("list.invite", {
        userId,
        memberships,
        collection: await repos.collections.getById(pending.collectionId),
      })
    ) {
      return;
    }
    await repos.invitations.upsert({
      ...pending,
      status: "revoked",
    });
  }
}

function readAllInvitations(): Invitation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("pickit-repo:invitations");
    return raw ? (JSON.parse(raw) as Invitation[]) : [];
  } catch {
    return [];
  }
}

export const invitationService = new InvitationService();

/** List-level operations with permissions + sync. */
export class ListService {
  async rename(
    collectionId: string,
    userId: string,
    name: string,
    emoji?: string,
  ): Promise<Collection | null> {
    const repos = getRepositories();
    const collection = await repos.collections.getById(collectionId);
    const memberships = await repos.memberships.listForCollection(collectionId);
    if (!can("list.rename", { userId, collection, memberships })) return null;
    if (!collection) return null;
    const next = {
      ...collection,
      name: name.trim() || collection.name,
      emoji: emoji ?? collection.emoji,
      ...stampUpdate(userId),
    };
    return syncEngine.optimisticMutate(
      () => repos.collections.upsert(next),
      {
        entityType: "collection",
        entityId: collectionId,
        operation: "upsert",
        payload: next,
      },
    );
  }

  async archive(collectionId: string, userId: string) {
    const repos = getRepositories();
    const collection = await repos.collections.getById(collectionId);
    const memberships = await repos.memberships.listForCollection(collectionId);
    if (!can("list.archive", { userId, collection, memberships })) return null;
    return repos.collections.archive(collectionId, userId);
  }

  async restore(collectionId: string, userId: string) {
    const repos = getRepositories();
    const collection = await repos.collections.getById(collectionId);
    const memberships = await repos.memberships.listForCollection(collectionId);
    if (!can("list.restore", { userId, collection, memberships })) return null;
    if (collection?.deletedAt) {
      return repos.collections.restore(collectionId, userId);
    }
    return repos.collections.unarchive(collectionId, userId);
  }

  async softDelete(collectionId: string, userId: string) {
    const repos = getRepositories();
    const collection = await repos.collections.getById(collectionId);
    const memberships = await repos.memberships.listForCollection(collectionId);
    if (!can("list.delete", { userId, collection, memberships })) return null;
    return repos.collections.softDelete(collectionId, userId);
  }

  async duplicate(collectionId: string, userId: string) {
    const repos = getRepositories();
    const collection = await repos.collections.getById(collectionId);
    const memberships = await repos.memberships.listForCollection(collectionId);
    if (!can("list.duplicate", { userId, collection, memberships })) {
      return null;
    }
    const copy = await repos.collections.duplicate(collectionId, userId);
    if (!copy) return null;
    await repos.memberships.upsert({
      id: createId("membership"),
      collectionId: copy.id,
      userId,
      role: "owner",
      joinedAt: new Date().toISOString(),
      ...stampCreate(userId),
    });
    domainEventBus.publish({
      id: createEventId(),
      type: "list.created",
      occurredAt: new Date().toISOString(),
      actorUserId: userId,
      collectionId: copy.id,
      payload: { name: copy.name },
    });
    return copy;
  }
}

export const listService = new ListService();
