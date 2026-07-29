/**
 * Provider-agnostic product analytics bus.
 * App code calls this file only; vendors stay behind providers.
 */

export type AnalyticsEventName = string;
export type AnalyticsProps = Record<
  string,
  string | number | boolean | null | undefined
>;
export type AnalyticsKind =
  | "track"
  | "screen"
  | "timing"
  | "error"
  | "feature"
  | "identify";

export type AnalyticsEnvelope = {
  id: string;
  kind: AnalyticsKind;
  event: AnalyticsEventName;
  props: AnalyticsProps;
  ts: string;
  appVersion: string;
  platform: string;
  browser: string;
  deviceType: "mobile" | "tablet" | "desktop" | "unknown";
  anonymousId: string;
  userId: string | null;
  crewId: string | null;
  sessionId: string;
};

export type AnalyticsProvider = {
  capture(batch: AnalyticsEnvelope[]): Promise<void> | void;
  identify?(userId: string, traits?: AnalyticsProps): Promise<void> | void;
  flush?(): Promise<void> | void;
  reset?(): Promise<void> | void;
};

type Snapshot = {
  queueSize: number;
  lastFlushAt: string | null;
  sentCount: number;
  failedCount: number;
  events: AnalyticsEnvelope[];
};

type RuntimeContext = {
  userId: string | null;
  crewId: string | null;
  sessionId: string;
  appVersion: string;
};

const STORAGE_KEY = "pickit-analytics-queue-v1";
const ANON_KEY = "pickit-analytics-anon-id-v1";
const MAX_QUEUE = 500;
const MAX_EVENT_LOG = 300;
const FLUSH_BATCH = 25;
const SENSITIVE_KEYS = [/email/i, /password/i, /token/i, /secret/i, /api.?key/i];

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getAnonymousId(): string {
  if (typeof window === "undefined") return "anon-server";
  const existing = window.localStorage.getItem(ANON_KEY);
  if (existing) return existing;
  const next = newId("anon");
  window.localStorage.setItem(ANON_KEY, next);
  return next;
}

function detectDeviceType(): "mobile" | "tablet" | "desktop" | "unknown" {
  if (typeof window === "undefined") return "unknown";
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function safeBrowserName(): string {
  if (typeof navigator === "undefined") return "server";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("edg")) return "edge";
  if (ua.includes("chrome")) return "chrome";
  if (ua.includes("safari") && !ua.includes("chrome")) return "safari";
  if (ua.includes("firefox")) return "firefox";
  return "unknown";
}

function sanitizeProps(input?: AnalyticsProps): AnalyticsProps {
  const out: AnalyticsProps = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    if (SENSITIVE_KEYS.some((rx) => rx.test(key))) continue;
    if (typeof value === "string") {
      if (value.includes("@")) continue;
      out[key] = value.slice(0, 300);
    } else {
      out[key] = value;
    }
  }
  return out;
}

class NullProvider implements AnalyticsProvider {
  capture(): void {}
}

class ConsoleAnalyticsProvider implements AnalyticsProvider {
  capture(batch: AnalyticsEnvelope[]): void {
    if (process.env.NODE_ENV !== "development") return;
    // eslint-disable-next-line no-console
    console.info("[analytics]", batch.map((row) => ({
      kind: row.kind,
      event: row.event,
      props: row.props,
      ts: row.ts,
    })));
  }
  identify(userId: string, traits?: AnalyticsProps): void {
    if (process.env.NODE_ENV !== "development") return;
    // eslint-disable-next-line no-console
    console.info("[analytics] identify", userId, traits ?? {});
  }
}

class PostHogAnalyticsProvider implements AnalyticsProvider {
  private enabled(): boolean {
    return typeof window !== "undefined" && Boolean((window as { posthog?: unknown }).posthog);
  }
  capture(batch: AnalyticsEnvelope[]): void {
    if (!this.enabled()) return;
    const posthog = (
      window as unknown as {
        posthog?: { capture: (event: string, props: AnalyticsProps) => void };
      }
    ).posthog;
    if (!posthog) return;
    for (const row of batch) {
      posthog.capture(row.event, {
        ...row.props,
        __kind: row.kind,
        __ts: row.ts,
        __appVersion: row.appVersion,
        __platform: row.platform,
        __browser: row.browser,
        __deviceType: row.deviceType,
        __anonymousId: row.anonymousId,
        __userId: row.userId,
        __crewId: row.crewId,
        __sessionId: row.sessionId,
      });
    }
  }
  identify(userId: string, traits?: AnalyticsProps): void {
    if (!this.enabled()) return;
    const posthog = (
      window as unknown as {
        posthog?: { identify: (id: string, props?: AnalyticsProps) => void };
      }
    ).posthog;
    if (!posthog) return;
    posthog.identify(userId, traits);
  }
}

function pickProvider(): AnalyticsProvider {
  const mode = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? "console";
  if (mode === "null") return new NullProvider();
  if (mode === "posthog") return new PostHogAnalyticsProvider();
  return new ConsoleAnalyticsProvider();
}

let provider: AnalyticsProvider = pickProvider();
let queue: AnalyticsEnvelope[] = [];
let eventLog: AnalyticsEnvelope[] = [];
let sentCount = 0;
let failedCount = 0;
let lastFlushAt: string | null = null;
let flushing = false;

const context: RuntimeContext = {
  userId: null,
  crewId: null,
  sessionId: newId("session"),
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
};

function hydrateQueue() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as AnalyticsEnvelope[];
    if (Array.isArray(parsed)) queue = parsed.slice(-MAX_QUEUE);
  } catch {
    // ignore
  }
}

function persistQueue() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {
    // ignore
  }
}

function pushEvent(kind: AnalyticsKind, event: AnalyticsEventName, props?: AnalyticsProps) {
  const envelope: AnalyticsEnvelope = {
    id: newId("evt"),
    kind,
    event,
    props: sanitizeProps(props),
    ts: new Date().toISOString(),
    appVersion: context.appVersion,
    platform:
      typeof navigator !== "undefined" ? navigator.platform || "web" : "server",
    browser: safeBrowserName(),
    deviceType: detectDeviceType(),
    anonymousId: getAnonymousId(),
    userId: context.userId,
    crewId: context.crewId,
    sessionId: context.sessionId,
  };
  queue.push(envelope);
  eventLog.push(envelope);
  queue = queue.slice(-MAX_QUEUE);
  eventLog = eventLog.slice(-MAX_EVENT_LOG);
  persistQueue();
}

async function flushInternal() {
  if (flushing || queue.length === 0) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  flushing = true;
  try {
    const batch = queue.slice(0, FLUSH_BATCH);
    await provider.capture(batch);
    queue = queue.slice(batch.length);
    sentCount += batch.length;
    lastFlushAt = new Date().toISOString();
    persistQueue();
  } catch {
    failedCount += 1;
  } finally {
    flushing = false;
  }
}

if (typeof window !== "undefined") {
  hydrateQueue();
  window.addEventListener("online", () => {
    void flushInternal();
  });
  window.setInterval(() => {
    void flushInternal();
  }, 8_000);
}

export function setAnalyticsProvider(next: AnalyticsProvider): void {
  provider = next;
}

export const analytics = {
  setContext(next: Partial<Pick<RuntimeContext, "userId" | "crewId" | "appVersion">>) {
    if (next.userId !== undefined) context.userId = next.userId;
    if (next.crewId !== undefined) context.crewId = next.crewId;
    if (next.appVersion !== undefined) context.appVersion = next.appVersion;
  },
  track(event: AnalyticsEventName, props?: AnalyticsProps) {
    try {
      pushEvent("track", event, props);
      void flushInternal();
    } catch {
      // ignore
    }
  },
  screen(name: string, props?: AnalyticsProps) {
    try {
      pushEvent("screen", "screen_viewed", { screen: name, ...props });
      void flushInternal();
    } catch {
      // ignore
    }
  },
  timing(name: string, durationMs: number, props?: AnalyticsProps) {
    try {
      pushEvent("timing", "timing_recorded", {
        metric: name,
        durationMs,
        ...props,
      });
      void flushInternal();
    } catch {
      // ignore
    }
  },
  error(event: string, props?: AnalyticsProps) {
    try {
      pushEvent("error", event, props);
      void flushInternal();
    } catch {
      // ignore
    }
  },
  feature(event: string, props?: AnalyticsProps) {
    try {
      pushEvent("feature", event, props);
      void flushInternal();
    } catch {
      // ignore
    }
  },
  identify(userId: string, traits?: AnalyticsProps) {
    try {
      context.userId = userId;
      pushEvent("identify", "identify", traits);
      void provider.identify?.(userId, sanitizeProps(traits));
      void flushInternal();
    } catch {
      // ignore
    }
  },
  async flush() {
    await flushInternal();
    try {
      await provider.flush?.();
    } catch {
      // ignore
    }
  },
  reset() {
    context.userId = null;
    context.crewId = null;
    context.sessionId = newId("session");
    queue = [];
    eventLog = [];
    persistQueue();
    try {
      void provider.reset?.();
    } catch {
      // ignore
    }
  },
  snapshot(): Snapshot {
    return {
      queueSize: queue.length,
      lastFlushAt,
      sentCount,
      failedCount,
      events: eventLog.slice(-80),
    };
  },
};
