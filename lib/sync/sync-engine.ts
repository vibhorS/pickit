import { createEventId, domainEventBus } from "@/lib/events/bus";
import { createId, getLocalRepositories } from "@/lib/repositories/local";
import { subscribeChanges } from "@/lib/repositories/local/storage";
import { getRepositories } from "@/lib/repositories/index";
import type { PendingOperation, SyncStatus } from "@/lib/types";

type SyncListener = (status: SyncStatus, pendingCount: number) => void;

const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 60_000;

/**
 * Centralized sync layer.
 * All features enqueue mutations here instead of implementing their own sync.
 */
class SyncEngine {
  private status: SyncStatus = "idle";
  private listeners = new Set<SyncListener>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private online = true;
  private started = false;
  private unsubscribers: Array<() => void> = [];

  start(): void {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    this.online = navigator.onLine;
    this.status = this.online ? "idle" : "offline";

    const onOnline = () => {
      this.online = true;
      this.setStatus("syncing");
      void this.flush();
    };
    const onOffline = () => {
      this.online = false;
      this.setStatus("offline");
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    this.unsubscribers.push(() => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    });

    // Cross-tab refresh hooks
    for (const channel of [
      "collections",
      "ratings",
      "memberships",
      "relationships",
      "activity",
    ]) {
      this.unsubscribers.push(
        subscribeChanges(channel, () => this.notify()),
      );
    }

    void this.flush();
  }

  stop(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.started = false;
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    void this.currentPendingCount().then((count) =>
      listener(this.status, count),
    );
    return () => this.listeners.delete(listener);
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  async enqueue(
    partial: Omit<PendingOperation, "id" | "createdAt" | "attempts">,
  ): Promise<PendingOperation> {
    const operation: PendingOperation = {
      ...partial,
      id: createId("pending"),
      createdAt: new Date().toISOString(),
      attempts: 0,
    };
    await getRepositories().offlineQueue.enqueue(operation);
    this.notify();
    if (this.online) {
      this.scheduleFlush(50);
    }
    return operation;
  }

  /**
   * Optimistic write helper: apply locally, queue for remote sync.
   * Local mode marks operations as applied immediately on flush.
   */
  async optimisticMutate<T>(
    applyLocal: () => Promise<T> | T,
    operation: Omit<PendingOperation, "id" | "createdAt" | "attempts">,
  ): Promise<T> {
    const result = await applyLocal();
    await this.enqueue(operation);
    return result;
  }

  async flush(): Promise<void> {
    if (!this.online) {
      this.setStatus("offline");
      return;
    }

    const repos = getRepositories();
    const queue = await repos.offlineQueue.list();
    if (queue.length === 0) {
      this.setStatus("idle");
      this.notify();
      return;
    }

    this.setStatus("syncing");

    for (const operation of queue) {
      try {
        await this.processOperation(operation);
        await repos.offlineQueue.remove(operation.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Sync failed";
        const attempts = operation.attempts + 1;
        const delay = Math.min(
          RETRY_BASE_MS * 2 ** Math.min(attempts, 5),
          RETRY_MAX_MS,
        );
        await repos.offlineQueue.update({
          ...operation,
          attempts,
          lastError: message,
          nextRetryAt: new Date(Date.now() + delay).toISOString(),
        });
        this.setStatus("error");
        domainEventBus.publish({
          id: createEventId(),
          type: "sync.conflict",
          occurredAt: new Date().toISOString(),
          actorUserId: "system",
          payload: {
            entityType: operation.entityType,
            entityId: operation.entityId,
            resolution: "retry-scheduled",
          },
        });
        this.scheduleFlush(delay);
        this.notify();
        return;
      }
    }

    this.setStatus("idle");
    this.notify();
  }

  /**
   * Conflict resolution: last-write-wins by updatedAt.
   * Callers should stamp updatedAt before enqueue.
   */
  resolveConflict<T extends { updatedAt?: string }>(
    local: T,
    remote: T,
  ): T {
    const localTime = local.updatedAt
      ? new Date(local.updatedAt).getTime()
      : 0;
    const remoteTime = remote.updatedAt
      ? new Date(remote.updatedAt).getTime()
      : 0;
    return remoteTime > localTime ? remote : local;
  }

  private async processOperation(operation: PendingOperation): Promise<void> {
    // Local backend is already applied optimistically.
    // When cloud is configured, this is where remote upserts/deletes run.
    const cloudReady = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
    if (!cloudReady) {
      // Simulate successful remote ack for local-first mode.
      return;
    }
    // Placeholder for Supabase remote apply.
    void operation;
    void getLocalRepositories;
  }

  private scheduleFlush(delayMs: number): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      void this.flush();
    }, delayMs);
  }

  private setStatus(status: SyncStatus): void {
    this.status = status;
    this.notify();
  }

  private async currentPendingCount(): Promise<number> {
    return (await getRepositories().offlineQueue.list()).length;
  }

  private notify(): void {
    void this.currentPendingCount().then((count) => {
      for (const listener of this.listeners) {
        listener(this.status, count);
      }
    });
  }
}

export const syncEngine = new SyncEngine();
