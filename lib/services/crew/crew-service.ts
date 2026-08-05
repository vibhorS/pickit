import { createCrewRepository } from "@/lib/repositories/cloud/crew-repository";
import { getCloudRepositories } from "@/lib/repositories/cloud";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { CrewSnapshot, CrewInvitation } from "@/lib/crew/types";
import type { UserProfile } from "@/lib/types";
import { logger } from "@/lib/observability/logger";

const crewRepo = () => createCrewRepository();

const POPULATED_CREW_MESSAGE =
  "You're already in a Crew with someone else. Leave that Crew before joining another.";

/**
 * Soft-leave every active membership except the target crew.
 * Solo/empty personal crews are archived. Populated crews block the invite.
 */
async function leavePriorCrewsForInvite(
  userId: string,
  targetCrewId: string,
): Promise<Set<string>> {
  const repo = crewRepo();
  const memberships = await repo.listMembershipsForUser(userId);
  const vacated = new Set<string>();

  for (const membership of memberships) {
    if (membership.crewId === targetCrewId) continue;

    const members = await repo.listMembers(membership.crewId);
    const hasOthers = members.some((member) => member.userId !== userId);
    if (hasOthers) {
      throw new Error(POPULATED_CREW_MESSAGE);
    }

    // Archive while still a member (RLS), then drop membership.
    try {
      await repo.softDeleteCrew(membership.crewId);
    } catch (error) {
      logger.warn("Could not archive vacated personal crew", {
        crewId: membership.crewId,
        message: error instanceof Error ? error.message : "unknown",
      });
    }
    await repo.removeMember(membership.crewId, userId);
    vacated.add(membership.crewId);
  }

  return vacated;
}

/**
 * Enforce one user → one crew for users who already have dual memberships
 * (e.g. accepted an invite before cleanup existed).
 */
async function reconcileToSingleCrew(userId: string): Promise<void> {
  const repo = crewRepo();
  const memberships = await repo.listMembershipsForUser(userId);
  if (memberships.length <= 1) return;

  const scored = await Promise.all(
    memberships.map(async (membership) => {
      const members = await repo.listMembers(membership.crewId);
      return {
        membership,
        hasOthers: members.some((member) => member.userId !== userId),
      };
    }),
  );

  const keep =
    scored.find((entry) => entry.hasOthers)?.membership ??
    scored[0]?.membership;
  if (!keep) return;

  for (const entry of scored) {
    if (entry.membership.crewId === keep.crewId) continue;

    if (entry.hasOthers) {
      // Should not happen under product rules — drop this user's extra membership.
      await repo.removeMember(entry.membership.crewId, userId);
      continue;
    }

    try {
      await repo.softDeleteCrew(entry.membership.crewId);
    } catch (error) {
      logger.warn("Could not archive reconciled personal crew", {
        crewId: entry.membership.crewId,
        message: error instanceof Error ? error.message : "unknown",
      });
    }
    await repo.removeMember(entry.membership.crewId, userId);
  }
}

/**
 * Crew collaboration service — UI never talks to Supabase directly.
 */
export const crewService = {
  async ensureCrew(profile: UserProfile) {
    if (!isSupabaseConfigured()) {
      throw new Error("Cloud is required for Crews.");
    }
    return crewRepo().ensurePersonalCrew(profile.id, profile.displayName);
  },

  async getSnapshot(userId: string): Promise<CrewSnapshot | null> {
    if (!isSupabaseConfigured()) return null;
    const repo = crewRepo();
    // Heal dual memberships left by older invite accepts (one user → one crew).
    await reconcileToSingleCrew(userId);
    const crew = await repo.getActiveCrewForUser(userId);
    if (!crew) return null;
    const [members, profiles, pending, activity] = await Promise.all([
      repo.listMembers(crew.id),
      repo.listMemberProfiles(crew.id),
      repo.listPendingInvites(crew.id),
      repo.listActivity(crew.id, 20),
    ]);
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    return {
      crew,
      members: members.map((member) => ({
        ...member,
        profile: profileMap.get(member.userId) ?? null,
      })),
      pendingInvite: pending[0] ?? null,
      activity,
    };
  },

  async invite(userId: string): Promise<{ token: string; invite: CrewInvitation }> {
    let snapshot = await this.getSnapshot(userId);
    if (!snapshot) {
      // Bootstrap personal Crew if cloud boot missed it (RLS / race).
      const { getCloudRepositories } = await import("@/lib/repositories/cloud");
      const profile = await getCloudRepositories().auth.getProfile();
      if (!profile || profile.id !== userId) {
        throw new Error("Sign in again to invite to your Crew.");
      }
      await this.ensureCrew(profile);
      snapshot = await this.getSnapshot(userId);
    }
    if (!snapshot) {
      throw new Error(
        "Could not create your Crew. Apply supabase/migrations Phase 2B (including the Crew RLS fix), then refresh.",
      );
    }
    const invite = await crewRepo().createInvitation(snapshot.crew.id, userId);
    await crewRepo().appendActivity({
      crewId: snapshot.crew.id,
      userId,
      type: "invite-sent",
      summary: "Invite to Crew sent",
      occurredAt: new Date().toISOString(),
    });
    return { token: invite.token, invite };
  },

  async acceptInvite(token: string, accepter: UserProfile): Promise<CrewSnapshot> {
    const repo = crewRepo();
    const invite = await repo.getInvitationByToken(token);
    if (!invite || invite.status !== "pending") {
      throw new Error("This Crew invite is no longer valid.");
    }
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
      await repo.updateInvitation({ ...invite, status: "expired" });
      throw new Error("This Crew invite has expired.");
    }

    // One user → one crew: leave/archive any prior solo crew, or reject if shared.
    const vacatedCrewIds = await leavePriorCrewsForInvite(
      accepter.id,
      invite.crewId,
    );

    await repo.addMember(invite.crewId, accepter.id, "member");
    await repo.updateInvitation({
      ...invite,
      status: "accepted",
      acceptedAt: new Date().toISOString(),
      acceptedByUserId: accepter.id,
    });

    // Move the accepter's lists onto the joined crew (orphans + vacated personal crew).
    const lists = await getCloudRepositories().lists.listForOwner(accepter.id);
    for (const list of lists) {
      if (!list.crewId || vacatedCrewIds.has(list.crewId)) {
        await getCloudRepositories().lists.upsert({
          ...list,
          crewId: invite.crewId,
          updatedBy: accepter.id,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    await repo.appendActivity({
      crewId: invite.crewId,
      userId: accepter.id,
      type: "member-joined",
      summary: `${accepter.displayName} joined the Crew`,
      occurredAt: new Date().toISOString(),
    });

    await repo.notify({
      userId: invite.invitedByUserId,
      crewId: invite.crewId,
      type: "invitation-accepted",
      message: `${accepter.displayName} joined your Crew.`,
    });

    const snapshot = await this.getSnapshot(accepter.id);
    if (!snapshot) throw new Error("Could not load Crew after join.");
    if (snapshot.crew.id !== invite.crewId) {
      throw new Error("Joined the Crew, but active Crew did not update. Refresh and try again.");
    }
    return snapshot;
  },

  async rejectInvite(token: string, userId: string): Promise<void> {
    const repo = crewRepo();
    const invite = await repo.getInvitationByToken(token);
    if (!invite || invite.status !== "pending") return;
    await repo.updateInvitation({
      ...invite,
      status: "rejected",
      rejectedAt: new Date().toISOString(),
    });
    void userId;
  },

  async cancelInvite(userId: string): Promise<void> {
    const snapshot = await this.getSnapshot(userId);
    if (!snapshot?.pendingInvite) return;
    const owner = snapshot.members.find(
      (member) => member.userId === userId && member.role === "owner",
    );
    if (!owner) return;
    await crewRepo().updateInvitation({
      ...snapshot.pendingInvite,
      status: "cancelled",
    });
  },

  async leaveCrew(userId: string): Promise<void> {
    const snapshot = await this.getSnapshot(userId);
    if (!snapshot) return;
    const membership = snapshot.members.find((member) => member.userId === userId);
    if (!membership) return;
    if (membership.role === "owner" && snapshot.members.length > 1) {
      throw new Error("Transfer ownership or remove members before leaving as owner.");
    }
    await crewRepo().removeMember(snapshot.crew.id, userId);
    // Ensure they still have a personal crew
    await crewRepo().ensurePersonalCrew(userId, "My");
  },

  /**
   * Owner removes another member. Soft-deletes crew_members only —
   * never deletes auth/users rows or collaborative content.
   */
  async removeCrewMember(
    ownerUserId: string,
    targetUserId: string,
  ): Promise<CrewSnapshot> {
    const snapshot = await this.getSnapshot(ownerUserId);
    if (!snapshot) throw new Error("Join or create a Crew first.");

    const actor = snapshot.members.find(
      (member) => member.userId === ownerUserId,
    );
    if (!actor || actor.role !== "owner") {
      throw new Error("Only the Crew owner can remove members.");
    }
    if (targetUserId === ownerUserId) {
      throw new Error("You cannot remove yourself from the Crew.");
    }
    const target = snapshot.members.find(
      (member) => member.userId === targetUserId,
    );
    if (!target) {
      throw new Error("That person is not in this Crew.");
    }

    await crewRepo().removeMemberByOwner(snapshot.crew.id, targetUserId);

    const next = await this.getSnapshot(ownerUserId);
    if (!next) throw new Error("Member removed but Crew could not be reloaded.");
    return next;
  },

  async renameCrew(userId: string, name: string): Promise<import("@/lib/crew/types").Crew> {
    const snapshot = await this.getSnapshot(userId);
    if (!snapshot) throw new Error("Join or create a Crew first.");
    const isOwner = snapshot.members.some(
      (member) => member.userId === userId && member.role === "owner",
    );
    if (!isOwner) throw new Error("Only the Crew owner can rename the Crew.");
    const nextName = name.trim() || snapshot.crew.name;
    const crew = await crewRepo().updateCrew(snapshot.crew.id, userId, {
      name: nextName,
    });
    await this.recordActivity({
      crewId: snapshot.crew.id,
      userId,
      type: "crew-renamed",
      summary: `Renamed Crew to ${crew.name}`,
    });
    return crew;
  },

  async recordActivity(input: {
    crewId: string;
    userId: string;
    type: import("@/lib/crew/types").CrewActivityType;
    listId?: string;
    movieId?: string;
    summary?: string;
  }) {
    if (!isSupabaseConfigured()) return;
    try {
      await crewRepo().appendActivity({
        crewId: input.crewId,
        userId: input.userId,
        listId: input.listId,
        movieId: input.movieId,
        type: input.type,
        summary: input.summary,
        occurredAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.warn("Crew activity failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  },

  async setPresence(
    userId: string,
    status: import("@/lib/crew/types").CrewPresenceStatus,
    crewId?: string,
    listId?: string,
  ) {
    if (!isSupabaseConfigured()) return null;
    return crewRepo().upsertPresence({
      userId,
      crewId,
      status,
      listId,
      updatedAt: new Date().toISOString(),
    });
  },
};
