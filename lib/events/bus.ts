import type { DomainEvent } from "@/lib/domain/events";

type Listener = (event: DomainEvent) => void;

/**
 * In-process domain event bus.
 * Notification service and sync engine subscribe here.
 * Future push providers attach without changing emitters.
 */
class DomainEventBus {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(event: DomainEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Subscribers must not break publishers.
      }
    }
  }
}

export const domainEventBus = new DomainEventBus();

export function createEventId(prefix = "evt"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
