"use client";

import Link from "next/link";
import { Camera, Home, Popcorn, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthBootstrap } from "@/components/auth/auth-bootstrap";
import { AuthGate } from "@/components/auth/auth-gate";
import { CaptureServiceProvider } from "@/components/capture/capture-service-provider";
import { CloudDataProvider } from "@/components/cloud/cloud-data-provider";
import { ErrorRecoveryBanner } from "@/components/sync/error-recovery-banner";
import { SyncIndicator } from "@/components/sync/sync-indicator";
import { TmdbAttribution } from "@/components/ui/tmdb-attribution";
import { AppQueryProvider } from "@/components/cloud/query-provider";
import { analytics } from "@/lib/observability/analytics";
import {
  SEED_COLLECTION_IDS,
  useCollaborationStore,
} from "@/store/collaboration-store";
import { useAuthStore } from "@/store/auth-store";
import { useLocalCollectionStore } from "@/store/local-collection-store";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [screenEnterAt, setScreenEnterAt] = useState<number>(Date.now());
  const immersivePrefixes = [
    "/rate/",
    "/tonight/",
    "/decision/",
    "/invite/",
  ];
  const hideNavigation = immersivePrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );
  const isInviteRoute = pathname.startsWith("/invite/");

  useEffect(() => {
    const navStart =
      typeof performance !== "undefined"
        ? performance.getEntriesByType("navigation")[0]
        : null;
    if (navStart && "duration" in navStart) {
      analytics.timing("app_startup", Math.round(navStart.duration), {
        route: pathname,
      });
    }
    analytics.screen(pathname, { route: pathname });
    analytics.track("session_app_open", { route: pathname });
    setScreenEnterAt(Date.now());
  }, [pathname]);

  useEffect(() => {
    const startedAt = screenEnterAt;
    let firstInteractionAt = 0;
    const tapCounts = new Map<string, number>();

    const onPointerDown = (event: Event) => {
      if (!firstInteractionAt) {
        firstInteractionAt = Date.now();
        analytics.timing("time_to_first_interaction", firstInteractionAt - startedAt, {
          route: pathname,
        });
      }
      const target = event.target as HTMLElement | null;
      const key =
        target?.getAttribute("data-analytics-id") ??
        target?.closest("button,a,[role='button']")?.textContent?.trim()?.slice(0, 80) ??
        "unknown-target";
      const next = (tapCounts.get(key) ?? 0) + 1;
      tapCounts.set(key, next);
      if (next === 4) {
        analytics.feature("repeated_tap_detected", { route: pathname, target: key });
      }
    };

    const onPopState = () => {
      analytics.track("back_navigation_used", { route: pathname });
    };

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("popstate", onPopState);
      analytics.timing("time_on_screen", Date.now() - startedAt, { route: pathname });
    };
  }, [pathname, screenEnterAt]);

  useEffect(() => {
    const onBeforeUnload = () => {
      analytics.track("session_end", { reason: "beforeunload" });
      void analytics.flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        analytics.track("session_end", { reason: "hidden" });
        void analytics.flush();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <CaptureServiceProvider>
      <AppQueryProvider>
        <AuthBootstrap>
          <AuthGate>
            <CloudDataProvider>
              <CollaborationMigration />
              <ErrorRecoveryBanner />
              {children}
              {!hideNavigation && !isInviteRoute && <TmdbAttribution />}
              <SyncIndicator />
              {!hideNavigation && !isInviteRoute && (
                <BottomNavigation pathname={pathname} />
              )}
            </CloudDataProvider>
          </AuthGate>
        </AuthBootstrap>
      </AppQueryProvider>
    </CaptureServiceProvider>
  );
}

function CollaborationMigration() {
  const [hydrated, setHydrated] = useState(false);
  const createdCollections = useLocalCollectionStore(
    (state) => state.createdCollections,
  );
  const migrateCollectionOwners = useCollaborationStore(
    (state) => state.migrateCollectionOwners,
  );

  useEffect(() => {
    const finish = () => {
      if (
        useCollaborationStore.persist.hasHydrated() &&
        useLocalCollectionStore.persist.hasHydrated()
      ) {
        queueMicrotask(() => setHydrated(true));
      }
    };
    const unsubscribeCollaboration =
      useCollaborationStore.persist.onFinishHydration(finish);
    const unsubscribeCollections =
      useLocalCollectionStore.persist.onFinishHydration(finish);
    finish();
    return () => {
      unsubscribeCollaboration();
      unsubscribeCollections();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const collectionIds = [
      ...SEED_COLLECTION_IDS,
      ...createdCollections.map((collection) => collection.id),
    ];
    queueMicrotask(() => migrateCollectionOwners(collectionIds));
  }, [createdCollections, hydrated, migrateCollectionOwners]);

  return null;
}

function BottomNavigation({ pathname }: { pathname: string }) {
  const profile = useAuthStore((state) => state.profile);
  const links = [
    {
      href: "/",
      label: "Home",
      icon: Home,
      active: pathname === "/",
    },
    {
      href: "/capture",
      label: "Capture",
      icon: Camera,
      active: pathname === "/capture",
    },
    {
      href: "/movie-night",
      label: "Movie Night",
      icon: Popcorn,
      active:
        pathname === "/movie-night" ||
        pathname.startsWith("/movie-night"),
    },
    {
      href: "/profile",
      label: profile?.displayName?.split(" ")[0] || "Profile",
      icon: UserRound,
      active: pathname === "/profile",
    },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-netflix-black/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-sm items-center justify-around">
        {links.map(({ href, label, icon: Icon, active }) => (
          <Link
            key={href}
            href={href}
            prefetch
            aria-current={active ? "page" : undefined}
            className={`flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-2.5 text-[0.6875rem] font-medium transition ${
              active ? "text-white" : "text-netflix-muted hover:text-white"
            }`}
          >
            <Icon
              className={`size-5 ${active ? "text-netflix-red" : ""}`}
              strokeWidth={active ? 2.4 : 1.8}
              aria-hidden="true"
            />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
