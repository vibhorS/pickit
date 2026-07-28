"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";

/** Boots auth, migration, sync, notifications, and presence once per app load. */
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const hydrated = useAuthStore((state) => state.hydrated);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-netflix-black text-netflix-muted">
        <p className="text-sm tracking-wide">Starting PickIt…</p>
      </div>
    );
  }

  return <>{children}</>;
}
