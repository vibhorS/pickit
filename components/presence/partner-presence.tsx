"use client";

import { useEffect, useState } from "react";
import { presenceService } from "@/lib/services/collaboration/notification-service";
import type { PresenceState } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";

function statusLabel(presence: PresenceState | null): string {
  if (!presence) return "Offline";
  switch (presence.status) {
    case "online":
      return "Online";
    case "recently-active":
      return "Recently active";
    case "rating":
      return "Rating movies";
    case "updating-list":
      return "Updating list";
    default:
      return "Offline";
  }
}

function statusDot(presence: PresenceState | null): string {
  if (!presence) return "bg-white/30";
  if (presence.status === "online" || presence.status === "rating") {
    return "bg-emerald-400";
  }
  if (presence.status === "recently-active" || presence.status === "updating-list") {
    return "bg-amber-400";
  }
  return "bg-white/30";
}

export function PartnerPresence() {
  const partner = useAuthStore((state) => state.partner);
  const [presence, setPresence] = useState<PresenceState | null>(null);

  useEffect(() => {
    const partnerId = partner.partner?.id;
    if (!partnerId) {
      queueMicrotask(() => setPresence(null));
      return;
    }
    let cancelled = false;
    async function load() {
      const next = await presenceService.getForUser(partnerId!);
      if (!cancelled) setPresence(next);
    }
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [partner.partner?.id]);

  if (partner.state !== "connected" || !partner.partner) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-netflix-muted">
      <span className={`size-2 rounded-full ${statusDot(presence)}`} />
      <span>
        {partner.partner.displayName} · {statusLabel(presence)}
      </span>
    </div>
  );
}
