const STORAGE_PREFIX = "pickit-repo:";

function key(name: string): string {
  return `${STORAGE_PREFIX}${name}`;
}

export function readJson<T>(name: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key(name));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(name: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(name), JSON.stringify(value));
}

export function removeKey(name: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key(name));
}

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Cross-tab broadcast so local "devices" (tabs) stay in sync during QA. */
export function broadcastChange(channel: string, payload?: unknown): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return;
  }
  try {
    const bc = new BroadcastChannel(`pickit-sync:${channel}`);
    bc.postMessage({ at: Date.now(), payload });
    bc.close();
  } catch {
    // Ignore environments without BroadcastChannel.
  }
}

export function subscribeChanges(
  channel: string,
  onChange: () => void,
): () => void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return () => undefined;
  }
  const bc = new BroadcastChannel(`pickit-sync:${channel}`);
  bc.onmessage = () => onChange();
  return () => bc.close();
}
