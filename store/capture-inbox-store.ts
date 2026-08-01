import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CaptureItem,
  CaptureProcessingStatus,
  MatchedRecommendation,
} from "@/lib/capture/intelligence/types";
import type { CaptureSource } from "@/lib/capture/types";
import {
  deleteCaptureMedia,
  putCaptureMedia,
} from "@/lib/capture/intelligence/image-store";

function createId(): string {
  return `cap-${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

const PLAIN_SOURCE: CaptureSource = {
  type: "plain-text",
  label: "Capture",
};

/** Persistable slice — drop heavy image blobs (kept in IndexedDB). */
type PersistedCaptureItem = Omit<
  CaptureItem,
  "imageDataUrl" | "rawAiOutput"
> & {
  imageDataUrl?: null;
  rawAiOutput?: null;
  hasMedia?: boolean;
};

type CaptureInboxStore = {
  items: CaptureItem[];
  activeId: string | null;
  searchQuery: string;
  statusFilter: CaptureProcessingStatus | "all" | "inbox";
  /** Active persistence scope (authenticated user id, or null when signed out). */
  scopedUserId: string | null;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (filter: CaptureInboxStore["statusFilter"]) => void;
  setActiveId: (id: string | null) => void;
  createFromMedia: (input: {
    mediaKind: CaptureItem["mediaKind"];
    imageDataUrl?: string | null;
    thumbnailDataUrl?: string | null;
    textContent?: string | null;
    sourceUrl?: string | null;
    source?: CaptureSource;
  }) => Promise<CaptureItem>;
  updateItem: (id: string, patch: Partial<CaptureItem>) => void;
  setMatches: (id: string, matches: MatchedRecommendation[]) => void;
  patchMatch: (
    id: string,
    matchId: string,
    patch: Partial<MatchedRecommendation>,
  ) => void;
  deleteItem: (id: string) => Promise<void>;
  archiveItem: (id: string) => void;
  getItem: (id: string) => CaptureItem | undefined;
};

/** Persist namespace prefix — never share one global bucket across accounts. */
export const CAPTURE_INBOX_PERSIST_PREFIX = "pickit-capture-inbox";

export function getCaptureInboxPersistName(
  userId: string | null | undefined,
): string {
  if (userId && userId.trim()) {
    return `${CAPTURE_INBOX_PERSIST_PREFIX}:${userId.trim()}`;
  }
  return `${CAPTURE_INBOX_PERSIST_PREFIX}:signed-out`;
}

const EMPTY_INBOX_MEMORY = {
  items: [] as CaptureItem[],
  activeId: null as string | null,
  searchQuery: "",
  statusFilter: "inbox" as CaptureInboxStore["statusFilter"],
};

export const useCaptureInboxStore = create<CaptureInboxStore>()(
  persist(
    (set, get) => ({
      ...EMPTY_INBOX_MEMORY,
      scopedUserId: null,

      setSearchQuery: (query) => set({ searchQuery: query }),
      setStatusFilter: (statusFilter) => set({ statusFilter }),
      setActiveId: (activeId) => set({ activeId }),

      createFromMedia: async (input) => {
        const id = createId();
        const createdAt = nowIso();
        const item: CaptureItem = {
          id,
          mediaKind: input.mediaKind,
          imageDataUrl: input.imageDataUrl ?? null,
          thumbnailDataUrl: input.thumbnailDataUrl ?? null,
          textContent: input.textContent ?? null,
          sourceUrl: input.sourceUrl ?? null,
          source: input.source ?? PLAIN_SOURCE,
          createdAt,
          updatedAt: createdAt,
          status: "queued",
          detectedCount: 0,
          matches: [],
          suggestedCollectionNames: [],
          selectedCollectionIds: [],
          createCollectionNames: [],
          importedMovieIds: [],
        };

        if (input.imageDataUrl) {
          try {
            await putCaptureMedia(
              id,
              input.imageDataUrl,
              input.thumbnailDataUrl ?? input.imageDataUrl,
            );
          } catch {
            // Keep in-memory copy if IndexedDB fails — never lose screenshot.
          }
        }

        set((state) => ({
          items: [item, ...state.items].slice(0, 80),
          activeId: id,
        }));
        return item;
      },

      updateItem: (id, patch) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? { ...item, ...patch, updatedAt: nowIso() }
              : item,
          ),
        })),

      setMatches: (id, matches) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  matches,
                  detectedCount: matches.length,
                  updatedAt: nowIso(),
                }
              : item,
          ),
        })),

      patchMatch: (id, matchId, patch) =>
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id !== id) return item;
            return {
              ...item,
              matches: item.matches.map((match) =>
                match.id === matchId ? { ...match, ...patch } : match,
              ),
              updatedAt: nowIso(),
            };
          }),
        })),

      deleteItem: async (id) => {
        try {
          await deleteCaptureMedia(id);
        } catch {
          // ignore
        }
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
          activeId: state.activeId === id ? null : state.activeId,
        }));
      },

      archiveItem: (id) => get().updateItem(id, { status: "archived" }),

      getItem: (id) => get().items.find((item) => item.id === id),
    }),
    {
      name: getCaptureInboxPersistName(null),
      version: 2,
      skipHydration: true,
      partialize: (state) => ({
        items: state.items.map(
          (item): PersistedCaptureItem => ({
            ...item,
            imageDataUrl: null,
            rawAiOutput: null,
            hasMedia: Boolean(item.thumbnailDataUrl || item.imageDataUrl),
          }),
        ),
        activeId: state.activeId,
      }),
      merge: (persisted, current) => {
        const data = (persisted ?? {}) as Partial<CaptureInboxStore>;
        return {
          ...current,
          ...data,
          items: (data.items ?? current.items).map((item) => ({
            ...item,
            matches: (item.matches ?? []).map((match) => ({
              ...match,
              matchDecision:
                match.matchDecision ??
                (match.matchStatus === "matched"
                  ? "auto-selected"
                  : match.matchStatus === "ambiguous"
                    ? "manual-review"
                    : "not-found"),
              decisionReason: match.decisionReason ?? "Legacy migration",
              dominanceGap: match.dominanceGap ?? 0,
              candidateCount:
                match.candidateCount ?? match.alternatives?.length ?? 0,
              candidateDiagnostics: match.candidateDiagnostics ?? [],
            })),
            suggestedCollectionNames: item.suggestedCollectionNames ?? [],
            selectedCollectionIds: item.selectedCollectionIds ?? [],
            createCollectionNames: item.createCollectionNames ?? [],
            importedMovieIds: item.importedMovieIds ?? [],
          })),
          // Scope is controlled by switchCaptureInboxScope, not storage.
          scopedUserId: current.scopedUserId,
        };
      },
    },
  ),
);

export function clearCaptureInboxMemory(): void {
  useCaptureInboxStore.setState({
    ...EMPTY_INBOX_MEMORY,
  });
}

/**
 * Persist + hydrate capture inbox for a single authenticated user.
 * Call on login, signup, session restore, and logout (userId = null).
 */
export async function switchCaptureInboxScope(
  userId: string | null,
): Promise<void> {
  const nextName = getCaptureInboxPersistName(userId);
  const currentName =
    useCaptureInboxStore.persist.getOptions().name ??
    getCaptureInboxPersistName(null);

  if (
    currentName === nextName &&
    useCaptureInboxStore.getState().scopedUserId === userId &&
    useCaptureInboxStore.persist.hasHydrated()
  ) {
    return;
  }

  useCaptureInboxStore.persist.setOptions({ name: nextName });
  clearCaptureInboxMemory();
  useCaptureInboxStore.setState({ scopedUserId: userId });
  await useCaptureInboxStore.persist.rehydrate();
  useCaptureInboxStore.setState({ scopedUserId: userId });
}

export function filterInboxItems(
  items: CaptureItem[],
  opts: {
    searchQuery: string;
    statusFilter: CaptureInboxStore["statusFilter"];
  },
): CaptureItem[] {
  const q = opts.searchQuery.trim().toLowerCase();
  return items.filter((item) => {
    if (opts.statusFilter === "inbox") {
      if (item.status === "archived" || item.status === "imported") return false;
    } else if (opts.statusFilter !== "all" && item.status !== opts.statusFilter) {
      return false;
    }
    if (!q) return true;
    const hay = [
      item.headline,
      item.theme,
      item.mood,
      item.source.label,
      item.textContent,
      item.sourceUrl,
      ...item.matches.map((m) => m.movie?.title ?? m.extracted.title),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
