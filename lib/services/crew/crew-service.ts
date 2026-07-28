import { createCrewRepository } from "@/lib/repositories/cloud/crew-repository";
import { getCloudRepositories } from "@/lib/repositories/cloud";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { CrewSnapshot, CrewInvitation } from "@/lib/crew/types";
import type { UserProfile } from "@/lib/types";
import { logger } from "@/lib/observability/logger";

const crewRepo = () => createCrewRepository();

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
    const snapshot = await this.getSnapshot(userId);
    if (!snapshot) throw new Error("Join or create a Crew first.");
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

    // Leave previous solo crew membership soft-delete if only member? Keep simple:
    // add to invited crew as member.
    await repo.addMember(invite.crewId, accepter.id, "member");
    await repo.updateInvitation({
      ...invite,
      status: "accepted",
      acceptedAt: new Date().toISOString(),
      acceptedByUserId: accepter.id,
    });

    // Attach accepter's owned lists without crew to this crew
    const lists = await getCloudRepositories().lists.listForOwner(accepter.id);
    for (const list of lists) {
      if (!list.crewId) {
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

    // Notify inviter
    await repo.notify({
      userId: invite.invitedByUserId,
      crewId: invite.crewId,
      type: "invitation-accepted",
      message: `${accepter.displayName} joined your Crew.`,
    });

    const snapshot = await this.getSnapshot(accepter.id);
    if (!snapshot) throw new Error("Could not load Crew after join.");
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

  async renameCrew(userId: string, name: string): Promise<void> {
    const snapshot = await this.getSnapshot(userId);
    if (!snapshot) return;
    const isOwner = snapshot.members.some(
      (member) => member.userId === userId && member.role === "owner",
    );
    if (!isOwner) throw new Error("Only the Crew owner can rename the Crew.");
    await crewRepo().updateCrew(snapshot.crew.id, userId, {
      name: name.trim() || snapshot.crew.name,
    });
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
