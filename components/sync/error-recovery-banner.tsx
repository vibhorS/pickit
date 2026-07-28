"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";

/**
 * Surfaces recoverable cloud/auth errors with a clear next action.
 */
export function ErrorRecoveryBanner() {
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const syncStatus = useAuthStore((state) => state.syncStatus);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [error, syncStatus]);

  if (dismissed) return null;

  if (error) {
    return (
      <div className="fixed inset-x-0 top-0 z-50 border-b border-red-500/30 bg-red-950/90 px-4 py-3 text-center text-sm text-red-100 backdrop-blur-md">
        {error}{" "}
        <button
          type="button"
          className="underline underline-offset-2"
          onClick={() => {
            clearError();
            setDismissed(true);
          }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (syncStatus === "error") {
    return (
      <div className="fixed inset-x-0 top-0 z-50 border-b border-amber-500/30 bg-amber-950/90 px-4 py-3 text-center text-sm text-amber-100 backdrop-blur-md">
        Sync hit a problem. Your changes are saved on this device and will
        retry automatically.{" "}
        <button
          type="button"
          className="underline underline-offset-2"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}
