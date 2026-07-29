import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createId } from "@/lib/repositories/local";
import type { UserProfile } from "@/lib/types";
import type {
  Crew,
  CrewActivity,
  CrewInvitation,
  CrewMember,
  CrewNotification,
  CrewPresence,
  CrewRole,
} from "@/lib/crew/types";

function mapCrew(row: Record<string, unknown>): Crew {
  return {
    id: String(row.id),
    name: String(row.name),
    avatarUrl: (row.avatar_url as string | null) ?? null,
    createdBy: String(row.created_by),
    updatedBy: String(row.updated_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: (row.deleted_at as string | null) ?? null,
  };
}

function mapMember(row: Record<string, unknown>): CrewMember {
  return {
    id: String(row.id),
    crewId: String(row.crew_id),
    userId: String(row.user_id),
    role: row.role as CrewRole,
    joinedAt: String(row.joined_at),
  };
}

function mapInvite(row: Record<string, unknown>): CrewInvitation {
  return {
    id: String(row.id),
    crewId: String(row.crew_id),
    invitedByUserId: String(row.invited_by_user_id),
    token: String(row.token),
    status: row.status as CrewInvitation["status"],
    expiresAt: (row.expires_at as string | null) ?? null,
    acceptedAt: (row.accepted_at as string | null) ?? null,
    acceptedByUserId: (row.accepted_by_user_id as string | null) ?? null,
    rejectedAt: (row.rejected_at as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

function mapUser(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    displayName: String(row.display_name),
    email: (row.email as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    color: String(row.color ?? "#e50914"),
    provider: (row.provider as UserProfile["provider"]) || "email",
    isGuest: Boolean(row.is_guest),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export type CrewRepository = {
  ensurePersonalCrew(userId: string, displayName: string): Promise<Crew>;
  getActiveCrewForUser(userId: string): Promise<Crew | null>;
  getById(crewId: string): Promise<Crew | null>;
  updateCrew(crewId: string, userId: string, patch: { name?: string }): Promise<Crew>;
  listMembers(crewId: string): Promise<CrewMember[]>;
  listMemberProfiles(crewId: string): Promise<UserProfile[]>;
  addMember(crewId: string, userId: string, role: CrewRole): Promise<CrewMember>;
  removeMember(crewId: string, userId: string): Promise<void>;
  createInvitation(crewId: string, invitedByUserId: string): Promise<CrewInvitation>;
  getInvitationByToken(token: string): Promise<CrewInvitation | null>;
  updateInvitation(invite: CrewInvitation): Promise<CrewInvitation>;
  listPendingInvites(crewId: string): Promise<CrewInvitation[]>;
  appendActivity(activity: Omit<CrewActivity, "id"> & { id?: string }): Promise<CrewActivity>;
  listActivity(crewId: string, limit?: number): Promise<CrewActivity[]>;
  upsertPresence(presence: CrewPresence): Promise<CrewPresence>;
  listPresence(userIds: string[]): Promise<CrewPresence[]>;
  notify(notification: Omit<CrewNotification, "id" | "createdAt"> & { id?: string }): Promise<void>;
  listNotifications(userId: string): Promise<CrewNotification[]>;
  subscribe(crewId: string, onChange: () => void): () => void;
};

export function createCrewRepository(): CrewRepository {
  return {
    async ensurePersonalCrew(userId, displayName) {
      const supabase = getSupabaseBrowserClient();
      const existing = await this.getActiveCrewForUser(userId);
      if (existing) return existing;

      const name = `${displayName.trim() || "Our"}'s Crew`;
      // Client-generated UUID so we never depend on SELECT-after-INSERT
      // before the owner membership row exists (RLS).
      const crewId = crypto.randomUUID();

      const { error: crewError } = await supabase.from("crews").insert({
        id: crewId,
        name,
        created_by: userId,
        updated_by: userId,
      });
      if (crewError) {
        // Race: another tab may have created a crew — re-read.
        const raced = await this.getActiveCrewForUser(userId);
        if (raced) return raced;
        throw new Error(crewError.message);
      }

      const { error: memberError } = await supabase.from("crew_members").insert({
        crew_id: crewId,
        user_id: userId,
        role: "owner",
      });
      if (memberError) {
        const raced = await this.getActiveCrewForUser(userId);
        if (raced) return raced;
        throw new Error(memberError.message);
      }

      const crew = await this.getById(crewId);
      if (!crew) {
        throw new Error(
          "Crew was created but could not be loaded. Apply the Phase 2B Crew RLS fix migration.",
        );
      }
      return crew;
    },

    async getActiveCrewForUser(userId) {
      const supabase = getSupabaseBrowserClient();
      const { data: memberships, error } = await supabase
        .from("crew_members")
        .select("crew_id")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("joined_at", { ascending: true })
        .limit(1);
      if (error) throw new Error(error.message);
      const crewId = memberships?.[0]?.crew_id;
      if (!crewId) return null;
      return this.getById(String(crewId));
    },

    async getById(crewId) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("crews")
        .select("*")
        .eq("id", crewId)
        .is("deleted_at", null)
        .limit(1);
      if (error) throw new Error(error.message);
      const row = data?.[0];
      return row ? mapCrew(row) : null;
    },

    async updateCrew(crewId, userId, patch) {
      const supabase = getSupabaseBrowserClient();
      const nextName = patch.name?.trim();
      if (!nextName) throw new Error("Crew name is required");

      // Prefer security-definer RPC so rename persists even if UPDATE RLS is wrong.
      const { data: rpcRow, error: rpcError } = await supabase.rpc(
        "rename_crew",
        {
          p_crew_id: crewId,
          p_name: nextName,
        },
      );

      if (!rpcError && rpcRow) {
        const row = Array.isArray(rpcRow) ? rpcRow[0] : rpcRow;
        if (row && typeof row === "object") {
          return mapCrew(row as Record<string, unknown>);
        }
      }

      if (rpcError) {
        const message = rpcError.message.toLowerCase();
        const missingFn =
          message.includes("could not find the function") ||
          message.includes("schema cache") ||
          rpcError.code === "PGRST202";
        if (!missingFn) throw new Error(rpcError.message);
      }

      // Fallback: direct update + verify the name actually changed.
      const { data, error } = await supabase
        .from("crews")
        .update({
          name: nextName,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", crewId)
        .select("id, name");
      if (error) throw new Error(error.message);
      if (!data?.length) {
        throw new Error(
          "Could not rename Crew. Re-run supabase/migrations/20260729_phase2b_crew_rls_fix.sql in the SQL editor.",
        );
      }
      if (String(data[0].name) !== nextName) {
        throw new Error("Crew rename did not persist. Re-apply the Crew RLS fix.");
      }
      const crew = await this.getById(crewId);
      if (!crew) throw new Error("Crew renamed but could not be reloaded.");
      return crew;
    },

    async listMembers(crewId) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("crew_members")
        .select("*")
        .eq("crew_id", crewId)
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapMember);
    },

    async listMemberProfiles(crewId) {
      const members = await this.listMembers(crewId);
      if (members.length === 0) return [];
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .in(
          "id",
          members.map((member) => member.userId),
        )
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapUser);
    },

    async addMember(crewId, userId, role) {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("crew_members").upsert(
        {
          crew_id: crewId,
          user_id: userId,
          role,
          joined_at: new Date().toISOString(),
          deleted_at: null,
        },
        { onConflict: "crew_id,user_id" },
      );
      if (error) throw new Error(error.message);
      const members = await this.listMembers(crewId);
      const member = members.find((entry) => entry.userId === userId);
      if (!member) throw new Error("Could not add member");
      return member;
    },

    async removeMember(crewId, userId) {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("crew_members")
        .update({ deleted_at: new Date().toISOString() })
        .eq("crew_id", crewId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },

    async createInvitation(crewId, invitedByUserId) {
      const supabase = getSupabaseBrowserClient();
      const existing = await this.listPendingInvites(crewId);
      if (existing[0]) return existing[0];

      const token = createId("crew-join");
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("crew_invitations").insert({
        crew_id: crewId,
        invited_by_user_id: invitedByUserId,
        token,
        status: "pending",
        expires_at: expiresAt,
      });
      if (error) throw new Error(error.message);
      const invite = await this.getInvitationByToken(token);
      if (!invite) throw new Error("Invite created but could not be loaded");
      return invite;
    },

    async getInvitationByToken(token) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("crew_invitations")
        .select("*")
        .eq("token", token)
        .limit(1);
      if (error) throw new Error(error.message);
      const row = data?.[0];
      return row ? mapInvite(row) : null;
    },

    async updateInvitation(invite) {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("crew_invitations")
        .update({
          status: invite.status,
          accepted_at: invite.acceptedAt ?? null,
          accepted_by_user_id: invite.acceptedByUserId ?? null,
          rejected_at: invite.rejectedAt ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invite.id);
      if (error) throw new Error(error.message);
      const next = await this.getInvitationByToken(invite.token);
      if (!next) throw new Error("Invite update failed");
      return next;
    },

    async listPendingInvites(crewId) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("crew_invitations")
        .select("*")
        .eq("crew_id", crewId)
        .eq("status", "pending");
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapInvite);
    },

    async appendActivity(activity) {
      const supabase = getSupabaseBrowserClient();
      const occurredAt = activity.occurredAt;
      const { error } = await supabase.from("crew_activity").insert({
        crew_id: activity.crewId,
        user_id: activity.userId,
        list_id: activity.listId ?? null,
        movie_id: activity.movieId ?? null,
        type: activity.type,
        summary: activity.summary ?? null,
        occurred_at: occurredAt,
      });
      if (error) throw new Error(error.message);
      // Don't require RETURNING — activity feed will refresh separately.
      return {
        id: activity.id ?? crypto.randomUUID(),
        crewId: activity.crewId,
        userId: activity.userId,
        listId: activity.listId ?? null,
        movieId: activity.movieId ?? null,
        type: activity.type,
        summary: activity.summary ?? null,
        occurredAt,
      };
    },

    async listActivity(crewId, limit = 30) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("crew_activity")
        .select("*")
        .eq("crew_id", crewId)
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: String(row.id),
        crewId: String(row.crew_id),
        userId: String(row.user_id),
        listId: (row.list_id as string | null) ?? null,
        movieId: (row.movie_id as string | null) ?? null,
        type: row.type as CrewActivity["type"],
        summary: (row.summary as string | null) ?? null,
        occurredAt: String(row.occurred_at),
      }));
    },

    async upsertPresence(presence) {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("presence").upsert({
        user_id: presence.userId,
        crew_id: presence.crewId ?? null,
        status: presence.status,
        list_id: presence.listId ?? null,
        updated_at: presence.updatedAt,
      });
      if (error) throw new Error(error.message);
      return presence;
    },

    async listPresence(userIds) {
      if (userIds.length === 0) return [];
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("presence")
        .select("*")
        .in("user_id", userIds);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        userId: String(row.user_id),
        crewId: (row.crew_id as string | null) ?? null,
        status: row.status as CrewPresence["status"],
        listId: (row.list_id as string | null) ?? null,
        updatedAt: String(row.updated_at),
      }));
    },

    async notify(notification) {
      const supabase = getSupabaseBrowserClient();
      await supabase.from("notifications").insert({
        user_id: notification.userId,
        crew_id: notification.crewId ?? null,
        list_id: notification.listId ?? null,
        type: notification.type,
        message: notification.message,
        event_id: notification.eventId ?? null,
      });
    },

    async listNotifications(userId) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: String(row.id),
        userId: String(row.user_id),
        crewId: (row.crew_id as string | null) ?? null,
        listId: (row.list_id as string | null) ?? null,
        type: row.type as CrewNotification["type"],
        message: String(row.message),
        eventId: (row.event_id as string | null) ?? null,
        createdAt: String(row.created_at),
        readAt: (row.read_at as string | null) ?? null,
      }));
    },

    subscribe(crewId, onChange) {
      const supabase = getSupabaseBrowserClient();
      const channel = supabase
        .channel(`crew:${crewId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "crew_members", filter: `crew_id=eq.${crewId}` },
          () => onChange(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "lists", filter: `crew_id=eq.${crewId}` },
          () => onChange(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "crew_activity", filter: `crew_id=eq.${crewId}` },
          () => onChange(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ratings" },
          () => onChange(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "recommendations" },
          () => onChange(),
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    },
  };
}
