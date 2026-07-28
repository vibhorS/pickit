"use client";

import { useEffect, useState } from "react";
import type { CrewPresence } from "@/lib/crew/types";
import { useCrewStore } from "@/store/crew-store";

function statusLabel(presence: CrewPresence | null | undefined): string {
  if (!presence) return "Offline";
  const ageMs = Date.now() - new Date(presence.updatedAt).getTime();
  switch (presence.status) {
    case "online":
      return "Online";
    case "rating":
      return "Rating movies…";
    case "updating-list":
      return "Updating list…";
    case "recently-active":
      if (ageMs < 5 * 60_000) return "Last active just now";
      if (ageMs < 60 * 60_000) {
        return `Last active ${Math.round(ageMs / 60_000)} min ago`;
      }
      return "Recently active";
    default:
      if (ageMs < 5 * 60_000) return "Last active just now";
      if (ageMs < 60 * 60_000) {
        return `Last active ${Math.round(ageMs / 60_000)} min ago`;
      }
      return "Offline";
  }
}

function statusDot(presence: CrewPresence | null | undefined): string {
  if (!presence) return "bg-white/30";
  if (presence.status === "online" || presence.status === "rating") {
    return "bg-emerald-400";
  }
  if (
    presence.status === "recently-active" ||
    presence.status === "updating-list"
  ) {
    return "bg-amber-400";
  }
  return "bg-white/30";
}

type CrewPresenceProps = {
  userId: string;
  displayName?: string;
};

export function CrewMemberPresence({
  userId,
  displayName,
}: CrewPresenceProps) {
  const presenceList = useCrewStore((state) => state.presence);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const presence = presenceList.find((entry) => entry.userId === userId);
  void tick;

  return (
    <div className="flex items-center gap-2 text-xs text-netflix-muted">
      <span className={`size-2 rounded-full ${statusDot(presence)}`} />
      <span>
        {displayName ? `${displayName} · ` : ""}
        {statusLabel(presence)}
      </span>
    </div>
  );
}
