import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CaptureSession } from "@/lib/capture/types";
import { DEFAULT_OWNER } from "@/lib/users";

export const EMPTY_CAPTURE_SESSIONS: CaptureSession[] = [];

type CaptureStore = {
  sessions: CaptureSession[];
  saveSession: (session: CaptureSession) => void;
  getSession: (sessionId: string) => CaptureSession | undefined;
};

export const useCaptureStore = create<CaptureStore>()(
  persist(
    (set, get) => ({
      sessions: EMPTY_CAPTURE_SESSIONS,

      saveSession: (session) =>
        set((state) => ({
          sessions: [
            session,
            ...state.sessions.filter((item) => item.id !== session.id),
          ].slice(0, 50),
        })),

      getSession: (sessionId) =>
        get().sessions.find((session) => session.id === sessionId),
    }),
    {
      name: "decision-capture-sessions",
      version: 1,
      partialize: (state) => ({ sessions: state.sessions }),
      migrate: (persisted) => {
        const data = (persisted ?? {}) as Partial<CaptureStore>;
        return {
          sessions: (data.sessions ?? EMPTY_CAPTURE_SESSIONS).map(
            (session) => ({
              ...session,
              savedByUserId:
                session.status === "saved"
                  ? session.savedByUserId ?? DEFAULT_OWNER.id
                  : session.savedByUserId,
            }),
          ),
        };
      },
      merge: (persisted, current) => {
        const data = (persisted ?? {}) as Partial<CaptureStore>;
        return {
          ...current,
          ...data,
          sessions: data.sessions ?? current.sessions,
        };
      },
    },
  ),
);
