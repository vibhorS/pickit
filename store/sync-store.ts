import { create } from "zustand";
import type { SyncStatus } from "@/lib/types";
import type { SavePipelineTrace } from "@/lib/sync/save-pipeline-trace";

export type SyncEvent = {
  id: string;
  type:
    | "write_pending"
    | "write_success"
    | "write_failed"
    | "write_retry"
    | "realtime_event"
    | "merge_conflict"
    | "snapshot_applied";
  entity: string;
  entityId: string;
  detail?: string;
  timestamp: string;
};

type SyncStore = {
  status: SyncStatus;
  repositoryMode: "cloud" | "local" | "unknown";
  lastSyncAt: string | null;
  realtimeConnected: boolean;
  pendingWrites: number;
  failedWrites: number;
  successfulWrites: number;
  retries: number;
  mergeConflicts: number;
  realtimeEvents: number;
  unsyncedObjects: number;
  recentEvents: SyncEvent[];
  lastSaveTrace: SavePipelineTrace | null;
  lastError: string | null;

  setStatus: (status: SyncStatus) => void;
  setRepositoryMode: (mode: "cloud" | "local") => void;
  setRealtimeConnected: (connected: boolean) => void;
  recordEvent: (event: Omit<SyncEvent, "id" | "timestamp">) => void;
  recordWriteSuccess: (entity: string, entityId: string) => void;
  recordWriteFailed: (entity: string, entityId: string, detail?: string) => void;
  recordWriteRetry: (entity: string, entityId: string) => void;
  recordRealtimeEvent: (entity: string, entityId: string) => void;
  recordMergeConflict: (entity: string, entityId: string, detail?: string) => void;
  setPendingWrites: (count: number) => void;
  setUnsyncedObjects: (count: number) => void;
  setLastSaveTrace: (trace: SavePipelineTrace) => void;
  setLastError: (error: string | null) => void;
};

function eventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function pushEvent(
  events: SyncEvent[],
  event: Omit<SyncEvent, "id" | "timestamp">,
): SyncEvent[] {
  return [
    { ...event, id: eventId(), timestamp: new Date().toISOString() },
    ...events,
  ].slice(0, 100);
}

export const useSyncStore = create<SyncStore>((set) => ({
  status: "idle",
  repositoryMode: "unknown",
  lastSyncAt: null,
  realtimeConnected: false,
  pendingWrites: 0,
  failedWrites: 0,
  successfulWrites: 0,
  retries: 0,
  mergeConflicts: 0,
  realtimeEvents: 0,
  unsyncedObjects: 0,
  recentEvents: [],
  lastSaveTrace: null,
  lastError: null,

  setStatus: (status) => set({ status }),
  setRepositoryMode: (mode) => set({ repositoryMode: mode }),
  setRealtimeConnected: (connected) => set({ realtimeConnected: connected }),
  setPendingWrites: (count) => set({ pendingWrites: count }),
  setUnsyncedObjects: (count) => set({ unsyncedObjects: count }),
  setLastSaveTrace: (trace) =>
    set({ lastSaveTrace: trace, lastError: trace.lastError }),
  setLastError: (error) => set({ lastError: error }),

  recordEvent: (event) =>
    set((state) => ({ recentEvents: pushEvent(state.recentEvents, event) })),

  recordWriteSuccess: (entity, entityId) =>
    set((state) => ({
      successfulWrites: state.successfulWrites + 1,
      lastSyncAt: new Date().toISOString(),
      recentEvents: pushEvent(state.recentEvents, {
        type: "write_success",
        entity,
        entityId,
      }),
    })),

  recordWriteFailed: (entity, entityId, detail) =>
    set((state) => ({
      failedWrites: state.failedWrites + 1,
      recentEvents: pushEvent(state.recentEvents, {
        type: "write_failed",
        entity,
        entityId,
        detail,
      }),
    })),

  recordWriteRetry: (entity, entityId) =>
    set((state) => ({
      retries: state.retries + 1,
      recentEvents: pushEvent(state.recentEvents, {
        type: "write_retry",
        entity,
        entityId,
      }),
    })),

  recordRealtimeEvent: (entity, entityId) =>
    set((state) => ({
      realtimeEvents: state.realtimeEvents + 1,
      recentEvents: pushEvent(state.recentEvents, {
        type: "realtime_event",
        entity,
        entityId,
      }),
    })),

  recordMergeConflict: (entity, entityId, detail) =>
    set((state) => ({
      mergeConflicts: state.mergeConflicts + 1,
      recentEvents: pushEvent(state.recentEvents, {
        type: "merge_conflict",
        entity,
        entityId,
        detail,
      }),
    })),
}));
