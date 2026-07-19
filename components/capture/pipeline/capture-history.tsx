"use client";

import { History } from "lucide-react";
import { getSourceIcon } from "@/lib/recommendation-source";
import type { CaptureSession } from "@/lib/capture/types";

type CaptureHistoryProps = {
  sessions: CaptureSession[];
  onSelect: (session: CaptureSession) => void;
};

function relativeDay(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const days = Math.round(
    (startToday.getTime() - startDate.getTime()) / 86_400_000,
  );

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function CaptureHistory({
  sessions,
  onSelect,
}: CaptureHistoryProps) {
  return (
    <section className="mx-auto mt-14 w-full max-w-2xl border-t border-white/5 pt-8">
      <div className="flex items-center gap-2">
        <History className="size-4 text-netflix-muted" strokeWidth={1.8} />
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-netflix-muted">
          Capture History
        </h2>
      </div>

      {sessions.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-white/[0.025] px-4 py-5 text-sm text-netflix-muted">
          Captures will appear here after you approve and save them.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {sessions.map((session) => {
            const Icon = getSourceIcon(session.result.source.type);
            const count = session.approvedCandidateIds.length;
            return (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => onSelect(session)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.035] px-4 py-3.5 text-left transition hover:bg-white/[0.065]"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-black/25 text-netflix-muted">
                    <Icon className="size-4.5" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-white">
                      {session.result.source.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-netflix-muted">
                      {count} {count === 1 ? "movie" : "movies"}
                    </span>
                  </span>
                  <span className="text-xs text-netflix-muted">
                    {relativeDay(session.savedAt ?? session.importedAt)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
