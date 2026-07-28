import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_COLLABORATOR,
  DEFAULT_OWNER,
  DEFAULT_USERS,
} from "@/lib/users";
import type {
  AppNotification,
  CollectionActivity,
  CollectionActivityType,
  CollectionMembership,
  Invitation,
  User,
} from "@/lib/types";

export const SEED_COLLECTION_IDS = [
  "date-night",
  "sci-fi",
  "comfort-movies",
];

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function seedMemberships(): CollectionMembership[] {
  return SEED_COLLECTION_IDS.flatMap((collectionId) => [
    {
      id: `membership-${collectionId}-${DEFAULT_OWNER.id}`,
      collectionId,
      userId: DEFAULT_OWNER.id,
      role: "owner" as const,
      joinedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: `membership-${collectionId}-${DEFAULT_COLLABORATOR.id}`,
      collectionId,
      userId: DEFAULT_COLLABORATOR.id,
      role: "member" as const,
      joinedAt: "2026-01-02T00:00:00.000Z",
    },
  ]);
}

type RecordActivityInput = {
  collectionId: string;
  userId: string;
  type: CollectionActivityType;
  movieId?: string;
};

type CollaborationStore = {
  users: User[];
  memberships: CollectionMembership[];
  invitations: Invitation[];
  notifications: AppNotification[];
  activity: CollectionActivity[];
  activeUserId: string;
  setActiveUser: (userId: string) => void;
  getUser: (userId: string) => User | undefined;
  getCollectionMembers: (collectionId: string) => User[];
  ensureOwner: (collectionId: string) => void;
  migrateCollectionOwners: (collectionIds: string[]) => void;
  createInvitation: (collectionId: string) => Invitation | null;
  acceptInvitation: (token: string, name: string) => User | null;
  revokeInvitation: (invitationId: string) => void;
  recordActivity: (input: RecordActivityInput) => void;
};

export const useCollaborationStore = create<CollaborationStore>()(
  persist(
    (set, get) => ({
      users: DEFAULT_USERS,
      memberships: seedMemberships(),
      invitations: [],
      notifications: [],
      activity: [],
      activeUserId: DEFAULT_OWNER.id,

      setActiveUser: (userId) => {
        if (!get().users.some((user) => user.id === userId)) return;
        set({ activeUserId: userId });
      },

      getUser: (userId) =>
        get().users.find((user) => user.id === userId),

      getCollectionMembers: (collectionId) => {
        const memberIds = new Set(
          get()
            .memberships.filter(
              (membership) => membership.collectionId === collectionId,
            )
            .map((membership) => membership.userId),
        );
        return get().users.filter((user) => memberIds.has(user.id));
      },

      ensureOwner: (collectionId) => {
        if (!collectionId) return;
        const userId = get().activeUserId;
        if (
          get().memberships.some(
            (membership) =>
              membership.collectionId === collectionId &&
              membership.userId === userId,
          )
        ) {
          return;
        }
        set((state) => ({
          memberships: [
            ...state.memberships,
            {
              id: createId("membership"),
              collectionId,
              userId,
              role: "owner",
              joinedAt: new Date().toISOString(),
            },
          ],
        }));
      },

      migrateCollectionOwners: (collectionIds) => {
        const uniqueIds = Array.from(
          new Set(collectionIds.filter(Boolean)),
        );
        if (uniqueIds.length === 0) return;
        set((state) => {
          const existingCollectionIds = new Set(
            state.memberships.map(
              (membership) => membership.collectionId,
            ),
          );
          const missing = uniqueIds.filter(
            (collectionId) =>
              !existingCollectionIds.has(collectionId),
          );
          if (missing.length === 0) return state;
          return {
            memberships: [
              ...state.memberships,
              ...missing.map((collectionId) => ({
                id: `membership-${collectionId}-${DEFAULT_OWNER.id}`,
                collectionId,
                userId: DEFAULT_OWNER.id,
                role: "owner" as const,
                joinedAt: "2026-01-01T00:00:00.000Z",
              })),
            ],
          };
        });
      },

      createInvitation: (collectionId) => {
        const isOwner = get().memberships.some(
          (membership) =>
            membership.collectionId === collectionId &&
            membership.userId === get().activeUserId &&
            membership.role === "owner",
        );
        if (!isOwner) return null;
        const existing = get().invitations.find(
          (invitation) =>
            invitation.collectionId === collectionId &&
            invitation.status === "pending",
        );
        if (existing) return existing;

        const invitation: Invitation = {
          id: createId("invitation"),
          collectionId,
          invitedByUserId: get().activeUserId,
          token: createId("join"),
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          invitations: [invitation, ...state.invitations],
        }));
        return invitation;
      },

      acceptInvitation: (token, name) => {
        const invitation = get().invitations.find(
          (entry) => entry.token === token && entry.status === "pending",
        );
        const trimmedName = name.trim();
        if (!invitation || !trimmedName) return null;

        const existingUser = get().users.find(
          (user) => user.name.toLowerCase() === trimmedName.toLowerCase(),
        );
        const user: User = existingUser ?? {
          id: createId("user"),
          name: trimmedName,
          color: "#8b5cf6",
        };
        const alreadyMember = get().memberships.some(
          (membership) =>
            membership.collectionId === invitation.collectionId &&
            membership.userId === user.id,
        );
        if (alreadyMember) return null;
        const acceptedAt = new Date().toISOString();
        set((state) => ({
          users: existingUser ? state.users : [...state.users, user],
          memberships: [
            ...state.memberships,
            {
              id: createId("membership"),
              collectionId: invitation.collectionId,
              userId: user.id,
              role: "member",
              joinedAt: acceptedAt,
            },
          ],
          invitations: state.invitations.map((entry) =>
            entry.id === invitation.id
              ? {
                  ...entry,
                  status: "accepted",
                  acceptedAt,
                  acceptedByUserId: user.id,
                }
              : entry,
          ),
          notifications: [
            {
              id: createId("notification"),
              userId: invitation.invitedByUserId,
              collectionId: invitation.collectionId,
              type: "invitation-accepted" as const,
              message: `${user.name} accepted your collection invite.`,
              createdAt: acceptedAt,
            },
            ...state.notifications,
          ].slice(0, 100),
          activeUserId: user.id,
        }));

        return user;
      },

      revokeInvitation: (invitationId) =>
        set((state) => ({
          invitations: state.invitations.map((invitation) =>
            invitation.id === invitationId
              ? { ...invitation, status: "revoked" }
              : invitation,
          ),
        })),

      recordActivity: (input) =>
        set((state) => {
          if (input.type === "ratings-completed") {
            const latestCompletion = state.activity.find(
              (entry) =>
                entry.collectionId === input.collectionId &&
                entry.userId === input.userId &&
                entry.type === "ratings-completed",
            );
            const latestAddition = state.activity.find(
              (entry) =>
                entry.collectionId === input.collectionId &&
                entry.type === "movie-added",
            );
            if (
              latestCompletion &&
              (!latestAddition ||
                new Date(latestCompletion.occurredAt).getTime() >=
                  new Date(latestAddition.occurredAt).getTime())
            ) {
              return state;
            }
          }
          return {
            activity: [
            {
              id: createId("activity"),
              collectionId: input.collectionId,
              userId: input.userId,
              type: input.type,
              movieId: input.movieId,
              occurredAt: new Date().toISOString(),
            },
            ...state.activity,
          ].slice(0, 200),
          };
        }),
    }),
    {
      name: "decision-collaboration",
      version: 1,
      partialize: (state) => ({
        users: state.users,
        memberships: state.memberships,
        invitations: state.invitations,
        notifications: state.notifications,
        activity: state.activity,
        activeUserId: state.activeUserId,
      }),
      migrate: (persisted) => {
        const data = (persisted ?? {}) as Partial<CollaborationStore>;
        const colors = [
          "#e50914",
          "#8b5cf6",
          "#0ea5e9",
          "#10b981",
        ];
        return {
          ...data,
          users: (data.users?.length ? data.users : DEFAULT_USERS).map(
            (user, index) => ({
              ...user,
              color: user.color ?? colors[index % colors.length],
            }),
          ),
          memberships:
            data.memberships?.length
              ? data.memberships
              : seedMemberships(),
          invitations: data.invitations ?? [],
          notifications: data.notifications ?? [],
          activity: data.activity ?? [],
          activeUserId:
            data.activeUserId ?? DEFAULT_OWNER.id,
        };
      },
      merge: (persisted, current) => {
        const data = (persisted ?? {}) as Partial<CollaborationStore>;
        return {
          ...current,
          ...data,
          users: data.users?.length ? data.users : current.users,
          memberships: data.memberships?.length
            ? data.memberships
            : current.memberships,
          invitations: data.invitations ?? current.invitations,
          notifications: data.notifications ?? current.notifications,
          activity: data.activity ?? current.activity,
          activeUserId:
            data.activeUserId &&
            (data.users ?? current.users).some(
              (user) => user.id === data.activeUserId,
            )
              ? data.activeUserId
              : current.activeUserId,
        };
      },
    },
  ),
);
