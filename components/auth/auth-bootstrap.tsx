"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { switchAuthenticatedLocalScope } from "@/store/switch-authenticated-local-scope";

/** Boots auth, then binds local persistence to the signed-in user. */
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const hydrated = useAuthStore((state) => state.hydrated);
  const profileId = useAuthStore((state) => state.profile?.id ?? null);
  const [localScopeReady, setLocalScopeReady] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!hydrated) {
      setLocalScopeReady(false);
      return;
    }

    let cancelled = false;
    setLocalScopeReady(false);
    void switchAuthenticatedLocalScope(profileId).then(() => {
      if (!cancelled) setLocalScopeReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [hydrated, profileId]);

  if (!hydrated || !localScopeReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-netflix-black text-netflix-muted">
        <p className="text-sm tracking-wide">Starting PickIt…</p>
      </div>
    );
  }

  return <>{children}</>;
}
