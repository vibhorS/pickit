import { create } from "zustand";
import type {
  Crew,
  CrewActivity,
  CrewInvitation,
  CrewMember,
  CrewPresence,
  CrewSnapshot,
} from "@/lib/crew/types";
import type { UserProfile } from "@/lib/types";

type CrewMemberWithProfile = CrewMember & { profile: UserProfile | null };

type CrewStore = {
  hydrated: boolean;
  crew: Crew | null;
  members: CrewMemberWithProfile[];
  pendingInvite: CrewInvitation | null;
  activity: CrewActivity[];
  presence: CrewPresence[];
  setSnapshot: (snapshot: CrewSnapshot | null) => void;
  setActivity: (activity: CrewActivity[]) => void;
  setPresence: (presence: CrewPresence[]) => void;
  clear: () => void;
  /** Other crew members excluding the current user. */
  otherMembers: (userId: string) => CrewMemberWithProfile[];
  /** Primary collaborator for 2-person crew UX (first other member). */
  primaryOtherMember: (userId: string) => CrewMemberWithProfile | null;
};

export const useCrewStore = create<CrewStore>((set, get) => ({
  hydrated: false,
  crew: null,
  members: [],
  pendingInvite: null,
  activity: [],
  presence: [],

  setSnapshot: (snapshot) => {
    if (!snapshot) {
      set({
        hydrated: true,
        crew: null,
        members: [],
        pendingInvite: null,
        activity: [],
      });
      return;
    }
    set({
      hydrated: true,
      crew: snapshot.crew,
      members: snapshot.members,
      pendingInvite: snapshot.pendingInvite,
      activity: snapshot.activity,
    });
  },

  setActivity: (activity) => set({ activity }),
  setPresence: (presence) => set({ presence }),

  clear: () =>
    set({
      hydrated: false,
      crew: null,
      members: [],
      pendingInvite: null,
      activity: [],
      presence: [],
    }),

  otherMembers: (userId) =>
    get().members.filter((member) => member.userId !== userId),

  primaryOtherMember: (userId) => {
    const others = get().otherMembers(userId);
    return others[0] ?? null;
  },
}));
