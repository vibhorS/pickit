/**
 * Product analytics abstraction — vendor-agnostic.
 * Bind PostHog / Amplitude / etc. via setAnalyticsProvider.
 */

export type AnalyticsEventName =
  | "app_opened"
  | "recommendation_added"
  | "movie_rated"
  | "movie_picked"
  | "movie_night_completed"
  | "partner_connected"
  | "search_performed"
  | "decision_mode_selected"
  | "auth_signed_in"
  | "auth_signed_up"
  | "feedback_submitted"
  | "settings_opened";

export type AnalyticsProps = Record<
  string,
  string | number | boolean | null | undefined
>;

export type AnalyticsProvider = {
  track(event: AnalyticsEventName, props?: AnalyticsProps): void;
  identify?(userId: string, traits?: AnalyticsProps): void;
  reset?(): void;
};

class NoopAnalytics implements AnalyticsProvider {
  track(): void {}
  identify(): void {}
  reset(): void {}
}

class ConsoleAnalytics implements AnalyticsProvider {
  track(event: AnalyticsEventName, props?: AnalyticsProps): void {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.info("[analytics]", event, props ?? {});
    }
  }
  identify(userId: string, traits?: AnalyticsProps): void {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.info("[analytics] identify", userId, traits ?? {});
    }
  }
  reset(): void {}
}

let provider: AnalyticsProvider =
  process.env.NODE_ENV === "production"
    ? new NoopAnalytics()
    : new ConsoleAnalytics();

export function setAnalyticsProvider(next: AnalyticsProvider): void {
  provider = next;
}

export const analytics = {
  track(event: AnalyticsEventName, props?: AnalyticsProps) {
    try {
      provider.track(event, props);
    } catch {
      // Analytics must never break the product.
    }
  },
  identify(userId: string, traits?: AnalyticsProps) {
    try {
      provider.identify?.(userId, traits);
    } catch {
      // ignore
    }
  },
  reset() {
    try {
      provider.reset?.();
    } catch {
      // ignore
    }
  },
};
