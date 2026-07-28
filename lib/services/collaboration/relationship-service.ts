import { stampCreate, stampUpdate } from "@/lib/domain/audit";
import { createEventId, domainEventBus } from "@/lib/events/bus";
import { getRepositories } from "@/lib/repositories/index";
import { createId } from "@/lib/repositories/local";
import { syncEngine } from "@/lib/sync/sync-engine";
import type {
  PartnerInvitation,
  PartnerRelationship,
  PartnerSnapshot,
  UserProfile,
} from "@/lib/types";

/**
 * Partner relationship service.
 * MVP: one active partner. Household id reserved for future multi-member homes.
 */
export class RelationshipService {
  async getSnapshot(userId: string): Promise<PartnerSnapshot> {
    const repos = getRepositories();
    const relationship = await repos.relationships.getActiveForUser(userId);
    const outgoing = (
      await repos.partnerInvitations.listPendingForUser(userId)
    )[0] ?? null;

    if (!relationship) {
      return {
        state: "no-partner",
        relationship: null,
        partner: null,
        outgoingInvite: outgoing,
      };
    }

    if (relationship.status === "pending") {
      const isInviter = relationship.inviterUserId === userId;
      return {
        state: isInviter ? "invite-pending" : "invitation-received",
        relationship,
        partner: null,
        outgoingInvite: outgoing,
      };
    }

    if (relationship.status === "connected" && relationship.partnerUserId) {
      const partnerId =
        relationship.inviterUserId === userId
          ? relationship.partnerUserId
          : relationship.inviterUserId;
      const partner = await repos.users.getById(partnerId);
      return {
        state: "connected",
        relationship,
        partner,
        outgoingInvite: null,
      };
    }

    return {
      state: "no-partner",
      relationship,
      partner: null,
      outgoingInvite: null,
    };
  }

  async invitePartner(userId: string): Promise<{
    relationship: PartnerRelationship;
    invitation: PartnerInvitation;
    token: string;
  }> {
    const repos = getRepositories();
    const existing = await repos.relationships.getActiveForUser(userId);
    if (existing && existing.status === "connected") {
      throw new Error("You already have a partner.");
    }
    if (existing && existing.status === "pending") {
      const invitation =
        (await repos.partnerInvitations.listPendingForUser(userId))[0] ??
        null;
      if (invitation) {
        return {
          relationship: existing,
          invitation,
          token: existing.inviteToken,
        };
      }
    }

    const now = new Date().toISOString();
    const householdId = createId("household");
    const relationshipId = createId("relationship");
    const token = createId("partner-join");

    const relationship: PartnerRelationship = {
      id: relationshipId,
      householdId,
      inviterUserId: userId,
      partnerUserId: null,
      status: "pending",
      inviteToken: token,
      ...stampCreate(userId, now),
    };

    const invitation: PartnerInvitation = {
      id: createId("partner-invite"),
      relationshipId,
      invitedByUserId: userId,
      token,
      status: "pending",
      createdAt: now,
    };

    await syncEngine.optimisticMutate(
      async () => {
        await repos.relationships.upsert(relationship);
        await repos.partnerInvitations.upsert(invitation);
      },
      {
        entityType: "relationship",
        entityId: relationshipId,
        operation: "upsert",
        payload: { relationship, invitation },
      },
    );

    domainEventBus.publish({
      id: createEventId(),
      type: "partner.invite.sent",
      occurredAt: now,
      actorUserId: userId,
      householdId,
      payload: { invitationId: invitation.id, token },
    });

    return { relationship, invitation, token };
  }

  async acceptInvite(
    token: string,
    accepter: UserProfile,
  ): Promise<PartnerRelationship> {
    const repos = getRepositories();
    const relationship = await repos.relationships.getByToken(token);
    if (!relationship || relationship.status !== "pending") {
      throw new Error("This invite is no longer valid.");
    }
    if (relationship.inviterUserId === accepter.id) {
      throw new Error("You cannot accept your own invite.");
    }

    const accepterActive = await repos.relationships.getActiveForUser(
      accepter.id,
    );
    if (accepterActive?.status === "connected") {
      throw new Error("You already have a partner.");
    }

    const now = new Date().toISOString();
    const next: PartnerRelationship = {
      ...relationship,
      partnerUserId: accepter.id,
      status: "connected",
      acceptedAt: now,
      ...stampUpdate(accepter.id, now),
    };

    const invitation = await repos.partnerInvitations.getByToken(token);
    await syncEngine.optimisticMutate(
      async () => {
        await repos.users.upsert(accepter);
        await repos.relationships.upsert(next);
        if (invitation) {
          await repos.partnerInvitations.upsert({
            ...invitation,
            status: "accepted",
            acceptedAt: now,
            acceptedByUserId: accepter.id,
          });
        }
        await this.shareOwnedListsWithPartner(
          relationship.inviterUserId,
          accepter.id,
          relationship.householdId,
        );
      },
      {
        entityType: "relationship",
        entityId: relationship.id,
        operation: "upsert",
        payload: next,
      },
    );

    domainEventBus.publish({
      id: createEventId(),
      type: "partner.joined",
      occurredAt: now,
      actorUserId: accepter.id,
      householdId: relationship.householdId,
      payload: {
        partnerUserId: relationship.inviterUserId,
        relationshipId: relationship.id,
      },
    });

    return next;
  }

  async declineInvite(token: string, userId: string): Promise<void> {
    const repos = getRepositories();
    const relationship = await repos.relationships.getByToken(token);
    if (!relationship || relationship.status !== "pending") return;

    const now = new Date().toISOString();
    const invitation = await repos.partnerInvitations.getByToken(token);

    await syncEngine.optimisticMutate(
      async () => {
        await repos.relationships.upsert({
          ...relationship,
          status: "declined",
          ...stampUpdate(userId, now),
          deletedAt: now,
        });
        if (invitation) {
          await repos.partnerInvitations.upsert({
            ...invitation,
            status: "declined",
            declinedAt: now,
          });
        }
      },
      {
        entityType: "relationship",
        entityId: relationship.id,
        operation: "soft-delete",
        payload: { token },
      },
    );

    domainEventBus.publish({
      id: createEventId(),
      type: "partner.invite.declined",
      occurredAt: now,
      actorUserId: userId,
      payload: { invitationId: invitation?.id ?? relationship.id },
    });
  }

  async cancelInvite(userId: string): Promise<void> {
    const repos = getRepositories();
    const relationship = await repos.relationships.getActiveForUser(userId);
    if (
      !relationship ||
      relationship.status !== "pending" ||
      relationship.inviterUserId !== userId
    ) {
      return;
    }

    const now = new Date().toISOString();
    const invitation =
      (await repos.partnerInvitations.listPendingForUser(userId))[0] ?? null;

    await syncEngine.optimisticMutate(
      async () => {
        await repos.relationships.upsert({
          ...relationship,
          status: "cancelled",
          ...stampUpdate(userId, now),
          deletedAt: now,
        });
        if (invitation) {
          await repos.partnerInvitations.upsert({
            ...invitation,
            status: "cancelled",
          });
        }
      },
      {
        entityType: "relationship",
        entityId: relationship.id,
        operation: "soft-delete",
        payload: { relationshipId: relationship.id },
      },
    );

    domainEventBus.publish({
      id: createEventId(),
      type: "partner.invite.cancelled",
      occurredAt: now,
      actorUserId: userId,
      payload: { invitationId: invitation?.id ?? relationship.id },
    });
  }

  async disconnect(userId: string): Promise<void> {
    const repos = getRepositories();
    const relationship = await repos.relationships.getActiveForUser(userId);
    if (!relationship || relationship.status !== "connected") return;

    const partnerUserId =
      relationship.inviterUserId === userId
        ? relationship.partnerUserId
        : relationship.inviterUserId;

    const now = new Date().toISOString();
    await syncEngine.optimisticMutate(
      async () => {
        await repos.relationships.upsert({
          ...relationship,
          status: "disconnected",
          disconnectedAt: now,
          ...stampUpdate(userId, now),
        });
      },
      {
        entityType: "relationship",
        entityId: relationship.id,
        operation: "upsert",
        payload: { status: "disconnected" },
      },
    );

    if (partnerUserId) {
      domainEventBus.publish({
        id: createEventId(),
        type: "partner.disconnected",
        occurredAt: now,
        actorUserId: userId,
        householdId: relationship.householdId,
        payload: {
          partnerUserId,
          relationshipId: relationship.id,
        },
      });
    }
  }

  /** When partners connect, share each person's owned lists with partner role. */
  private async shareOwnedListsWithPartner(
    userA: string,
    userB: string,
    householdId: string,
  ): Promise<void> {
    const repos = getRepositories();
    const now = new Date().toISOString();

    for (const ownerId of [userA, userB]) {
      const partnerId = ownerId === userA ? userB : userA;
      const owned = await repos.collections.list({
        ownerId,
        includeArchived: true,
      });
      const memberships = await repos.memberships.listForUser(ownerId);

      const ownedIds = new Set([
        ...owned.map((c) => c.id),
        ...memberships
          .filter((m) => m.role === "owner")
          .map((m) => m.collectionId),
      ]);

      for (const collectionId of ownedIds) {
        const collection = await repos.collections.getById(collectionId);
        if (!collection || collection.deletedAt) continue;

        await repos.collections.upsert({
          ...collection,
          householdId,
          ...stampUpdate(ownerId, now),
        });

        await repos.memberships.upsert({
          id: createId("membership"),
          collectionId,
          userId: partnerId,
          role: "partner",
          joinedAt: now,
          ...stampCreate(ownerId, now),
        });

        domainEventBus.publish({
          id: createEventId(),
          type: "list.shared",
          occurredAt: now,
          actorUserId: ownerId,
          householdId,
          collectionId,
          payload: { memberUserIds: [partnerId] },
        });
      }
    }
  }
}

export const relationshipService = new RelationshipService();
