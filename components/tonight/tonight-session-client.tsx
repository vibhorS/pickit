"use client";

import { useEffect, useState } from "react";
import { TonightSession } from "@/components/tonight/tonight-session";
import { getMutualMatchMovies } from "@/lib/match-engine";
import type { Movie, MovieVote } from "@/lib/types";
import { CURRENT_USER } from "@/lib/users";
import { useVoteStore } from "@/store/vote-store";

type TonightSessionClientProps = {
  collectionId: string;
  collectionName: string;
  movies: Movie[];
  partnerVotes: MovieVote[];
};

export function TonightSessionClient({
  collectionId,
  collectionName,
  movies,
  partnerVotes,
}: TonightSessionClientProps) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const votes = useVoteStore((state) => state.votes);

  useEffect(() => {
    const unsub = useVoteStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    if (useVoteStore.persist.hasHydrated()) {
      setHasHydrated(true);
    }

    return unsub;
  }, []);

  if (!hasHydrated) {
    return (
      <div className="mx-auto flex w-full max-w-lg items-center justify-center py-24">
        <p className="text-sm text-netflix-muted">Loading tonight&apos;s picks...</p>
      </div>
    );
  }

  const userVotes = votes.filter(
    (vote) =>
      vote.collectionId === collectionId && vote.userId === CURRENT_USER.id,
  );
  const matches = getMutualMatchMovies(movies, userVotes, partnerVotes);

  return (
    <TonightSession
      collectionId={collectionId}
      collectionName={collectionName}
      matches={matches}
    />
  );
}
