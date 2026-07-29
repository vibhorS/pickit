"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Users } from "lucide-react";
import { CrewPanel } from "@/components/crew/crew-panel";
import { Surface } from "@/components/ui/surface";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useCollectionStats } from "@/store/collection-stats-selector";
import { useCrewStore } from "@/store/crew-store";
import { useLocalCollectionStore } from "@/store/local-collection-store";
import { useVoteStore } from "@/store/vote-store";

function activityLabel(type: string, summary?: string | null): string {
  if (summary) return summary;
  switch (type) {
    case "movie-added":
      return "Added a recommendation";
    case "movie-rated":
      return "Rated a movie";
    case "movie-night-completed":
      return "Movie Night completed";
    case "list-created":
      return "New list created";
    case "list-renamed":
      return "Renamed a list";
    case "crew-renamed":
      return "Renamed the Crew";
    case "member-joined":
      return "Joined the Crew";
    case "invite-sent":
      return "Invite to Crew sent";
    default:
      return "Crew update";
  }
}

export function CrewHomeClient() {
  const crew = useCrewStore((state) => state.crew);
  const members = useCrewStore((state) => state.members);
  const activity = useCrewStore((state) => state.activity);
  const lists = useLocalCollectionStore((state) => state.createdCollections);
  const votes = useVoteStore((state) => state.votes);
  const primaryListId = lists[0]?.id ?? "date-night";
  const stats = useCollectionStats(primaryListId);

  const memberName = useMemo(() => {
    const map = new Map(
      members.map((m) => [m.userId, m.profile?.displayName ?? "Member"]),
    );
    return (userId: string) => map.get(userId) ?? "Someone";
  }, [members]);

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-lg px-5 py-12">
        <h1 className="text-3xl font-bold text-white">Your Crew</h1>
        <p className="mt-3 text-sm text-netflix-muted">
          Cloud is not configured yet. Local demo collaboration still works from
          Profile → Developer.
        </p>
        <Link
          href="/profile"
          className="btn-primary mt-6 inline-flex"
        >
          Open Profile
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-5 pb-28 pt-10">
      <div className="flex items-center gap-3">
        <Users className="size-6 text-netflix-red" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-netflix-muted">
            PickIt
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            {crew?.name ?? "Your Crew"}
          </h1>
        </div>
      </div>
      <p className="mt-3 text-sm text-netflix-muted">
        Our movie space — shared lists, ratings, and Movie Night.
      </p>

      <Surface className="mt-8">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-netflix-muted">
          Shared statistics
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-semibold text-white">{lists.length}</p>
            <p className="text-[0.65rem] text-netflix-muted">Lists</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-white">{votes.length}</p>
            <p className="text-[0.65rem] text-netflix-muted">Ratings</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-white">
              {stats.mutualMatches}
            </p>
            <p className="text-[0.65rem] text-netflix-muted">Matches</p>
          </div>
        </div>
      </Surface>

      <CrewPanel />

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-white">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="mt-3 text-sm text-netflix-muted">
            Activity from your Crew will show up here.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {activity.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl bg-white/[0.03] px-3 py-3 text-sm text-netflix-muted"
              >
                <span className="text-white">{memberName(entry.userId)}</span>{" "}
                {activityLabel(entry.type, entry.summary)}
                <span className="mt-1 block text-[0.65rem] text-netflix-muted/70">
                  {new Date(entry.occurredAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10">
        <Link href="/collections" className="btn-secondary inline-flex">
          Browse shared lists
        </Link>
      </div>
    </div>
  );
}
