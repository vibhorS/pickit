import {
  createId,
  readJson,
  writeJson,
} from "@/lib/repositories/local/storage";
import type { PendingOperation } from "@/lib/types";

const QUEUE_KEY = "cloud-offline-queue";

/**
 * Offline mutation queue — not a source of truth.
 * Canonical data lives in Supabase; this only holds pending writes.
 */
export const offlineQueue = {
  async list(): Promise<PendingOperation[]> {
    return readJson<PendingOperation[]>(QUEUE_KEY, []);
  },
  async enqueue(
    partial: Omit<PendingOperation, "id" | "createdAt" | "attempts">,
  ): Promise<PendingOperation> {
    const operation: PendingOperation = {
      ...partial,
      id: createId("pending"),
      createdAt: new Date().toISOString(),
      attempts: 0,
    };
    const queue = await this.list();
    queue.push(operation);
    writeJson(QUEUE_KEY, queue);
    return operation;
  },
  async update(operation: PendingOperation): Promise<void> {
    const queue = await this.list();
    const index = queue.findIndex((item) => item.id === operation.id);
    if (index >= 0) queue[index] = operation;
    writeJson(QUEUE_KEY, queue);
  },
  async remove(id: string): Promise<void> {
    writeJson(
      QUEUE_KEY,
      (await this.list()).filter((item) => item.id !== id),
    );
  },
  async clear(): Promise<void> {
    writeJson(QUEUE_KEY, []);
  },
};
