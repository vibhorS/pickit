import type { UserProfile } from "@/lib/types";

export type CrewRole = "owner" | "admin" | "member";

export type Crew = {
  id: string;
  name: string;
  avatarUrl: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type CrewMember = {
  id: string;
  crewId: string;
  userId: string;
  role: CrewRole;
  joinedAt: string;
};

export type CrewInvitationStatus =
  | "pending"
  | "accepted"
  | "expired"
  | "cancelled"
  | "rejected";

export type CrewInvitation = {
  id: string;
  crewId: string;
  invitedByUserId: string;
  token: string;
  status: CrewInvitationStatus;
  expiresAt?: string | null;
  acceptedAt?: string | null;
  acceptedByUserId?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
};

export type CrewActivityType =
  | "movie-added"
  | "movie-rated"
  | "movie-night-completed"
  | "list-created"
  | "list-renamed"
  | "member-joined"
  | "invite-sent";

export type CrewActivity = {
  id: string;
  crewId: string;
  userId: string;
  listId?: string | null;
  movieId?: string | null;
  type: CrewActivityType;
  summary?: string | null;
  occurredAt: string;
};

export type CrewPresenceStatus =
  | "online"
  | "recently-active"
  | "rating"
  | "updating-list"
  | "offline";

export type CrewPresence = {
  userId: string;
  crewId?: string | null;
  status: CrewPresenceStatus;
  listId?: string | null;
  updatedAt: string;
};

export type CrewNotificationType =
  | "invitation-accepted"
  | "recommendation-added"
  | "movie-rated"
  | "movie-night-ready"
  | "member-joined"
  | "list-shared";

export type CrewNotification = {
  id: string;
  userId: string;
  crewId?: string | null;
  listId?: string | null;
  type: CrewNotificationType;
  message: string;
  eventId?: string | null;
  createdAt: string;
  readAt?: string | null;
};

export type CrewSnapshot = {
  crew: Crew;
  members: Array<CrewMember & { profile: UserProfile | null }>;
  pendingInvite: CrewInvitation | null;
  activity: CrewActivity[];
};
