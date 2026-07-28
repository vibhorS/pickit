"use client";

import Link from "next/link";
import { Home, Library, UserRound, Users } from "lucide-react";
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
  const immersivePrefixes = [
    "/movie-night",
    "/rate/",
    "/tonight/",
    "/capture",
    "/invite/",
  ];
  const hideNavigation = immersivePrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );
  const isInviteRoute = pathname.startsWith("/invite/");

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
      href: "/collections",
      label: "Lists",
      icon: Library,
      active:
        pathname === "/collections" ||
        pathname.startsWith("/collection/"),
    },
    {
      href: "/crew",
      label: "Crew",
      icon: Users,
      active: pathname === "/crew" || pathname.startsWith("/crew"),
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
