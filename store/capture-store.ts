import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CaptureSession } from "@/lib/capture/types";
import { isLegacyUserId } from "@/lib/identity/canonical-user-id";

export const EMPTY_CAPTURE_SESSIONS: CaptureSession[] = [];

type CaptureStore = {
  sessions: CaptureSession[];
  /** Active persistence scope (authenticated user id, or null when signed out). */
  scopedUserId: string | null;
  saveSession: (session: CaptureSession) => void;
  getSession: (sessionId: string) => CaptureSession | undefined;
};

/** Persist namespace prefix — never share one global bucket across accounts. */
export const CAPTURE_SESSIONS_PERSIST_PREFIX = "decision-capture-sessions";

export function getCaptureSessionsPersistName(
  userId: string | null | undefined,
): string {
  if (userId && userId.trim()) {
    return `${CAPTURE_SESSIONS_PERSIST_PREFIX}:${userId.trim()}`;
  }
  return `${CAPTURE_SESSIONS_PERSIST_PREFIX}:signed-out`;
}

export const useCaptureStore = create<CaptureStore>()(
  persist(
    (set, get) => ({
      sessions: EMPTY_CAPTURE_SESSIONS,
      scopedUserId: null,

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
      name: getCaptureSessionsPersistName(null),
      version: 3,
      skipHydration: true,
      partialize: (state) => ({ sessions: state.sessions }),
      migrate: (persisted) => {
        const data = (persisted ?? {}) as Partial<CaptureStore>;
        return {
          sessions: (data.sessions ?? EMPTY_CAPTURE_SESSIONS).map(
            (session) => ({
              ...session,
              savedByUserId:
                session.savedByUserId &&
                !isLegacyUserId(session.savedByUserId)
                  ? session.savedByUserId
                  : undefined,
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
          scopedUserId: current.scopedUserId,
        };
      },
    },
  ),
);

export function clearCaptureSessionsMemory(): void {
  useCaptureStore.setState({
    sessions: EMPTY_CAPTURE_SESSIONS,
  });
}

/**
 * Persist + hydrate capture sessions for a single authenticated user.
 * Call on login, signup, session restore, and logout (userId = null).
 */
export async function switchCaptureSessionsScope(
  userId: string | null,
): Promise<void> {
  const nextName = getCaptureSessionsPersistName(userId);
  const currentName =
    useCaptureStore.persist.getOptions().name ??
    getCaptureSessionsPersistName(null);

  if (
    currentName === nextName &&
    useCaptureStore.getState().scopedUserId === userId &&
    useCaptureStore.persist.hasHydrated()
  ) {
    return;
  }

  useCaptureStore.persist.setOptions({ name: nextName });
  clearCaptureSessionsMemory();
  useCaptureStore.setState({ scopedUserId: userId });
  await useCaptureStore.persist.rehydrate();
  useCaptureStore.setState({ scopedUserId: userId });
}
