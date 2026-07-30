import { getCloudRepositories } from "@/lib/repositories/cloud";
import type {
  CloudList,
  CloudRating,
  CloudRecommendation,
} from "@/lib/repositories/cloud/types";
import { offlineQueue } from "@/lib/sync/offline-queue";
import { logger } from "@/lib/observability/logger";
import type { PendingOperation, SyncStatus } from "@/lib/types";
import type { Movie } from "@/lib/types";

type SyncListener = (status: SyncStatus, pendingCount: number) => void;

const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 60_000;
const MAX_ATTEMPTS = 10;

function getSyncStore() {
  // Lazy import to avoid circular dependency at module init
  return import("@/store/sync-store").then((m) => m.useSyncStore.getState());
}

/**
 * Cloud sync engine — optimistic local apply + background flush to Supabase.
 * All writes are queued and retried. Failures are instrumented via SyncStore.
 */
class CloudSyncEngine {
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
    void offlineQueue.list().then((queue) => listener(this.status, queue.length));
    return () => this.listeners.delete(listener);
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  async enqueue(
    partial: Omit<PendingOperation, "id" | "createdAt" | "attempts">,
  ): Promise<PendingOperation> {
    const operation = await offlineQueue.enqueue(partial);
    void getSyncStore().then((s) => {
      s.recordEvent({
        type: "write_pending",
        entity: partial.entityType,
        entityId: partial.entityId,
      });
    });
    this.notify();
    if (this.online) this.scheduleFlush(50);
    return operation;
  }

  async flush(): Promise<void> {
    if (!this.online) {
      this.setStatus("offline");
      return;
    }
    const queue = await offlineQueue.list();
    if (queue.length === 0) {
      this.setStatus("idle");
      this.notify();
      return;
    }
    this.setStatus("syncing");
    const repos = getCloudRepositories();

    for (const operation of queue) {
      try {
        await this.applyRemote(operation, repos);
        await offlineQueue.remove(operation.id);
        void getSyncStore().then((s) => {
          s.recordWriteSuccess(operation.entityType, operation.entityId);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync failed";
        const attempts = operation.attempts + 1;

        if (attempts >= MAX_ATTEMPTS) {
          logger.error("Cloud sync permanently failed", {
            entityType: operation.entityType,
            entityId: operation.entityId,
            message,
            attempts,
          });
          await offlineQueue.remove(operation.id);
          void getSyncStore().then((s) => {
            s.recordWriteFailed(
              operation.entityType,
              operation.entityId,
              `Gave up after ${attempts} attempts: ${message}`,
            );
          });
          void import("@/store/auth-store").then(({ useAuthStore }) => {
            useAuthStore.getState().setCloudSyncMeta("error", 0);
          });
          continue;
        }

        const delay = Math.min(
          RETRY_BASE_MS * 2 ** Math.min(attempts, 5),
          RETRY_MAX_MS,
        );
        await offlineQueue.update({
          ...operation,
          attempts,
          lastError: message,
          nextRetryAt: new Date(Date.now() + delay).toISOString(),
        });
        logger.warn("Cloud sync retry scheduled", { message, attempts });
        void getSyncStore().then((s) => {
          s.recordWriteRetry(operation.entityType, operation.entityId);
        });
        this.setStatus("error");
        this.scheduleFlush(delay);
        this.notify();
        return;
      }
    }
    this.setStatus("idle");
    this.notify();
  }

  resolveConflict<T extends { updatedAt?: string }>(local: T, remote: T): T {
    const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
    const remoteTime = remote.updatedAt
      ? new Date(remote.updatedAt).getTime()
      : 0;
    return remoteTime >= localTime ? remote : local;
  }

  private async applyRemote(
    operation: PendingOperation,
    repos: ReturnType<typeof getCloudRepositories>,
  ): Promise<void> {
    const payload = operation.payload as Record<string, unknown>;
    switch (operation.entityType) {
      case "collection": {
        if (operation.operation === "soft-delete") {
          await repos.lists.softDelete(
            operation.entityId,
            String(payload.userId ?? ""),
          );
        } else {
          await repos.lists.upsert(payload as unknown as CloudList);
        }
        break;
      }
      case "recommendation": {
        if (operation.operation === "soft-delete") {
          await repos.recommendations.softDelete(
            String(payload.listId),
            String(payload.movieId),
            String(payload.userId),
          );
        } else {
          const moviePayload = payload.movie as Movie | undefined;
          if (moviePayload) {
            await repos.movies.upsert(moviePayload);
          }
          await repos.recommendations.upsert(
            payload as unknown as CloudRecommendation,
          );
        }
        break;
      }
      case "rating": {
        await repos.ratings.upsert(payload as unknown as CloudRating);
        break;
      }
      case "user": {
        break;
      }
      default: {
        if (payload.movie) {
          await repos.movies.upsert(payload.movie as Movie);
        }
      }
    }
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

  private notify(): void {
    void offlineQueue.list().then((queue) => {
      void getSyncStore().then((s) => {
        s.setPendingWrites(queue.length);
        s.setStatus(this.status);
      });
      for (const listener of this.listeners) {
        listener(this.status, queue.length);
      }
    });
  }
}

export const cloudSyncEngine = new CloudSyncEngine();
