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
      const { data: existing } = await supabase
        .from("crew_members")
        .select("crew_id")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();

      if (existing?.crew_id) {
        const crew = await this.getById(String(existing.crew_id));
        if (crew) return crew;
      }

      const name = `${displayName}'s Crew`;
      const { data: created, error } = await supabase
        .from("crews")
        .insert({
          name,
          created_by: userId,
          updated_by: userId,
        })
        .select("*")
        .single();
      if (error || !created) throw new Error(error?.message ?? "Could not create Crew");

      await supabase.from("crew_members").insert({
        crew_id: created.id,
        user_id: userId,
        role: "owner",
      });

      return mapCrew(created);
    },

    async getActiveCrewForUser(userId) {
      const supabase = getSupabaseBrowserClient();
      const { data: membership } = await supabase
        .from("crew_members")
        .select("crew_id")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!membership) return null;
      return this.getById(String(membership.crew_id));
    },

    async getById(crewId) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("crews")
        .select("*")
        .eq("id", crewId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapCrew(data) : null;
    },

    async updateCrew(crewId, userId, patch) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("crews")
        .update({
          name: patch.name,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", crewId)
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Update failed");
      return mapCrew(data);
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
      const { data, error } = await supabase
        .from("crew_members")
        .upsert(
          {
            crew_id: crewId,
            user_id: userId,
            role,
            joined_at: new Date().toISOString(),
            deleted_at: null,
          },
          { onConflict: "crew_id,user_id" },
        )
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not add member");
      return mapMember(data);
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
      const { data, error } = await supabase
        .from("crew_invitations")
        .insert({
          crew_id: crewId,
          invited_by_user_id: invitedByUserId,
          token,
          status: "pending",
          expires_at: expiresAt,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Invite failed");
      return mapInvite(data);
    },

    async getInvitationByToken(token) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("crew_invitations")
        .select("*")
        .eq("token", token)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapInvite(data) : null;
    },

    async updateInvitation(invite) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("crew_invitations")
        .update({
          status: invite.status,
          accepted_at: invite.acceptedAt ?? null,
          accepted_by_user_id: invite.acceptedByUserId ?? null,
          rejected_at: invite.rejectedAt ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invite.id)
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Invite update failed");
      return mapInvite(data);
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
      const row = {
        id: activity.id ?? createId("activity"),
        crew_id: activity.crewId,
        user_id: activity.userId,
        list_id: activity.listId ?? null,
        movie_id: activity.movieId ?? null,
        type: activity.type,
        summary: activity.summary ?? null,
        occurred_at: activity.occurredAt,
      };
      const { data, error } = await supabase
        .from("crew_activity")
        .insert(row)
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Activity failed");
      return {
        id: String(data.id),
        crewId: String(data.crew_id),
        userId: String(data.user_id),
        listId: (data.list_id as string | null) ?? null,
        movieId: (data.movie_id as string | null) ?? null,
        type: data.type as CrewActivity["type"],
        summary: (data.summary as string | null) ?? null,
        occurredAt: String(data.occurred_at),
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
      const { data, error } = await supabase
        .from("presence")
        .upsert({
          user_id: presence.userId,
          crew_id: presence.crewId ?? null,
          status: presence.status,
          list_id: presence.listId ?? null,
          updated_at: presence.updatedAt,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Presence failed");
      return {
        userId: String(data.user_id),
        crewId: (data.crew_id as string | null) ?? null,
        status: data.status as CrewPresence["status"],
        listId: (data.list_id as string | null) ?? null,
        updatedAt: String(data.updated_at),
      };
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
        id: notification.id ?? createId("notification"),
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
