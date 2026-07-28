"use client";

import { Cloud, CloudOff, Loader2, RefreshCw } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { syncEngine } from "@/lib/sync/sync-engine";

/** Subtle connection / sync indicator for offline-first UX. */
export function SyncIndicator() {
  const syncStatus = useAuthStore((state) => state.syncStatus);
  const pendingOps = useAuthStore((state) => state.pendingOps);

  if (syncStatus === "idle" && pendingOps === 0) return null;

  const label =
    syncStatus === "offline"
      ? "Offline — changes saved on this device"
      : syncStatus === "syncing"
        ? "Syncing…"
        : syncStatus === "error"
          ? "Sync issue — retrying"
          : pendingOps > 0
            ? `${pendingOps} pending`
            : null;

  if (!label) return null;

  const Icon =
    syncStatus === "offline"
      ? CloudOff
      : syncStatus === "syncing"
        ? Loader2
        : syncStatus === "error"
          ? RefreshCw
          : Cloud;

  return (
    <button
      type="button"
      onClick={() => void syncEngine.flush()}
      className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-3 py-1.5 text-xs text-netflix-muted backdrop-blur-md"
      title="Sync status"
    >
      <Icon
        className={`size-3.5 ${syncStatus === "syncing" ? "animate-spin" : ""}`}
      />
      {label}
    </button>
  );
}
