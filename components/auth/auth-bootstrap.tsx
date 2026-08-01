"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { switchLocalCollectionScope } from "@/store/local-collection-store";

/** Boots auth, then binds collection persistence to the signed-in user. */
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const hydrated = useAuthStore((state) => state.hydrated);
  const profileId = useAuthStore((state) => state.profile?.id ?? null);
  const [collectionsReady, setCollectionsReady] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!hydrated) {
      setCollectionsReady(false);
      return;
    }

    let cancelled = false;
    setCollectionsReady(false);
    void switchLocalCollectionScope(profileId).then(() => {
      if (!cancelled) setCollectionsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [hydrated, profileId]);

  if (!hydrated || !collectionsReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-netflix-black text-netflix-muted">
        <p className="text-sm tracking-wide">Starting PickIt…</p>
      </div>
    );
  }

  return <>{children}</>;
}
