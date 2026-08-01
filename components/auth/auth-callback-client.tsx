"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { PASSWORD_RESET_PATH } from "@/lib/auth/password-reset";

/**
 * Legacy/auth callback shim: forward recovery codes to /auth/reset-password.
 */
function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("next")) {
      // Keep any code/error params; land on the dedicated reset route.
    }
    router.replace(
      `${PASSWORD_RESET_PATH}${params.toString() ? `?${params.toString()}` : ""}`,
    );
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-netflix-black text-netflix-muted">
      <p className="text-sm tracking-wide">Opening password reset…</p>
    </div>
  );
}

export function AuthCallbackClient() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-netflix-black text-netflix-muted">
          <p className="text-sm tracking-wide">Opening password reset…</p>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
