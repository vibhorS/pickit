import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PartnerStatus = "none" | "waiting" | "joined";

type CollectionPartnerState = {
  status: PartnerStatus;
  inviteCode: string | null;
};

type PartnerStore = {
  byCollection: Record<string, CollectionPartnerState>;
  getState: (collectionId: string) => CollectionPartnerState;
  generateInvite: (collectionId: string) => string;
  markJoined: (collectionId: string) => void;
  reset: (collectionId: string) => void;
};

function createInviteCode(): string {
  return `invite-${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_PARTNER_STATE: CollectionPartnerState = {
  status: "none",
  inviteCode: null,
};

export const usePartnerStore = create<PartnerStore>()(
  persist(
    (set, get) => ({
      byCollection: {},

      getState: (collectionId) => {
        return get().byCollection[collectionId] ?? DEFAULT_PARTNER_STATE;
      },

      generateInvite: (collectionId) => {
        const inviteCode = createInviteCode();
        set((state) => ({
          byCollection: {
            ...state.byCollection,
            [collectionId]: { status: "waiting", inviteCode },
          },
        }));
        return inviteCode;
      },

      markJoined: (collectionId) =>
        set((state) => {
          const current = state.byCollection[collectionId];
          return {
            byCollection: {
              ...state.byCollection,
              [collectionId]: {
                status: "joined",
                inviteCode: current?.inviteCode ?? null,
              },
            },
          };
        }),

      reset: (collectionId) =>
        set((state) => {
          const next = { ...state.byCollection };
          delete next[collectionId];
          return { byCollection: next };
        }),
    }),
    {
      name: "decision-partner",
      partialize: (state) => ({ byCollection: state.byCollection }),
    },
  ),
);
