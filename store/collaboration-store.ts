import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  isLegacyUserId,
  remapUserId,
} from "@/lib/identity/canonical-user-id";
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

/** Fresh installs start with no memberships — ensureOwner / auth remap populate UUIDs. */
function seedMemberships(): CollectionMembership[] {
  return [];
}

type RecordActivityInput = {
  collectionId: string;
  userId: string;
  type: CollectionActivityType;
  movieId?: string;
};

type AdoptCanonicalIdentityInput = {
  userId: string;
  displayName: string;
  email?: string | null;
  avatarUrl?: string | null;
  color: string;
  partnerUserId?: string | null;
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
  adoptCanonicalIdentity: (input: AdoptCanonicalIdentityInput) => void;
  createInvitation: (collectionId: string) => Invitation | null;
  acceptInvitation: (token: string, name: string) => User | null;
  revokeInvitation: (invitationId: string) => void;
  recordActivity: (input: RecordActivityInput) => void;
};

export const useCollaborationStore = create<CollaborationStore>()(
  persist(
    (set, get) => ({
      users: [],
      memberships: seedMemberships(),
      invitations: [],
      notifications: [],
      activity: [],
      activeUserId: "",

      setActiveUser: (userId) => {
        if (!userId) return;
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
        if (!userId || isLegacyUserId(userId)) return;
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
        const ownerId = get().activeUserId;
        if (!ownerId || isLegacyUserId(ownerId)) return;
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
                id: `membership-${collectionId}-${ownerId}`,
                collectionId,
                userId: ownerId,
                role: "owner" as const,
                joinedAt: new Date().toISOString(),
              })),
            ],
          };
        });
      },

      adoptCanonicalIdentity: (input) => {
        const canonicalUserId = input.userId;
        if (!canonicalUserId || isLegacyUserId(canonicalUserId)) return;
        const partnerUserId =
          input.partnerUserId &&
          input.partnerUserId !== canonicalUserId &&
          !isLegacyUserId(input.partnerUserId)
            ? input.partnerUserId
            : null;

        set((state) => {
          const mapId = (id: string) =>
            remapUserId(id, canonicalUserId, partnerUserId);

          const asUser: User = {
            id: canonicalUserId,
            name: input.displayName,
            email: input.email ?? undefined,
            avatarUrl: input.avatarUrl ?? undefined,
            color: input.color,
          };

          const usersById = new Map<string, User>();
          for (const user of state.users) {
            const nextId = mapId(user.id);
            if (!nextId) continue;
            const existing = usersById.get(nextId);
            usersById.set(nextId, {
              ...user,
              ...existing,
              id: nextId,
              ...(nextId === canonicalUserId ? asUser : {}),
            });
          }
          usersById.set(canonicalUserId, {
            ...usersById.get(canonicalUserId),
            ...asUser,
          });

          // Ensure seed collections are owned by the authenticated user.
          const memberships: CollectionMembership[] = [];
          const seen = new Set<string>();
          for (const membership of state.memberships) {
            const nextUserId = mapId(membership.userId);
            if (!nextUserId) continue;
            const key = `${membership.collectionId}\u001f${nextUserId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            memberships.push({
              ...membership,
              id: `membership-${membership.collectionId}-${nextUserId}`,
              userId: nextUserId,
            });
          }
          for (const collectionId of SEED_COLLECTION_IDS) {
            const key = `${collectionId}\u001f${canonicalUserId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            memberships.push({
              id: `membership-${collectionId}-${canonicalUserId}`,
              collectionId,
              userId: canonicalUserId,
              role: "owner",
              joinedAt: new Date().toISOString(),
            });
          }

          const invitations: Invitation[] = [];
          for (const invitation of state.invitations) {
            const invitedByUserId = mapId(invitation.invitedByUserId);
            if (!invitedByUserId) continue;
            let acceptedByUserId = invitation.acceptedByUserId;
            if (invitation.acceptedByUserId) {
              const mapped = mapId(invitation.acceptedByUserId);
              if (!mapped) continue;
              acceptedByUserId = mapped;
            }
            invitations.push({
              ...invitation,
              invitedByUserId,
              acceptedByUserId,
            });
          }

          const notifications: AppNotification[] = [];
          for (const notification of state.notifications) {
            const userId = mapId(notification.userId);
            if (!userId) continue;
            notifications.push({ ...notification, userId });
          }

          const activity: CollectionActivity[] = [];
          for (const entry of state.activity) {
            const userId = mapId(entry.userId);
            if (!userId) continue;
            activity.push({ ...entry, userId });
          }

          return {
            users: Array.from(usersById.values()).filter(
              (user) => !isLegacyUserId(user.id),
            ),
            memberships,
            invitations,
            notifications,
            activity,
            activeUserId: canonicalUserId,
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
                  status: "accepted" as const,
                  acceptedByUserId: user.id,
                  acceptedAt,
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
      version: 2,
      partialize: (state) => ({
        users: state.users,
        memberships: state.memberships,
        invitations: state.invitations,
        notifications: state.notifications,
        activity: state.activity,
        activeUserId: state.activeUserId,
      }),
      migrate: (persisted, version) => {
        const data = (persisted ?? {}) as Partial<CollaborationStore>;
        const colors = [
          "#e50914",
          "#8b5cf6",
          "#0ea5e9",
          "#10b981",
        ];
        // v2: strip username memberships. Auth adoptCanonicalIdentity
        // rewrites remaining legacy rows and owns seed collections after login.
        const memberships =
          version < 2
            ? (data.memberships ?? []).filter(
                (m) => m && !isLegacyUserId(m.userId),
              )
            : data.memberships?.length
              ? data.memberships
              : seedMemberships();

        const users = (data.users?.length ? data.users : [])
          .filter((user) => user && !isLegacyUserId(user.id))
          .map((user, index) => ({
            ...user,
            color: user.color ?? colors[index % colors.length],
          }));

        const activeUserId =
          data.activeUserId && !isLegacyUserId(data.activeUserId)
            ? data.activeUserId
            : "";

        return {
          ...data,
          users,
          memberships,
          invitations: data.invitations ?? [],
          notifications: data.notifications ?? [],
          activity: data.activity ?? [],
          activeUserId,
        };
      },
      merge: (persisted, current) => {
        const data = (persisted ?? {}) as Partial<CollaborationStore>;
        const users = (data.users?.length ? data.users : current.users).filter(
          (user) => !isLegacyUserId(user.id),
        );
        const memberships = (
          data.memberships?.length ? data.memberships : current.memberships
        ).filter((membership) => !isLegacyUserId(membership.userId));
        const activeUserId =
          data.activeUserId &&
          !isLegacyUserId(data.activeUserId) &&
          users.some((user) => user.id === data.activeUserId)
            ? data.activeUserId
            : current.activeUserId && !isLegacyUserId(current.activeUserId)
              ? current.activeUserId
              : "";
        return {
          ...current,
          ...data,
          users,
          memberships,
          invitations: data.invitations ?? current.invitations,
          notifications: data.notifications ?? current.notifications,
          activity: data.activity ?? current.activity,
          activeUserId,
        };
      },
    },
  ),
);
