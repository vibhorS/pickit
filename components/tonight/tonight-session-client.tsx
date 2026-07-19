"use client";

import { useEffect, useState } from "react";
import { TonightSession } from "@/components/tonight/tonight-session";
import { MovieDetailSkeleton } from "@/components/ui/skeleton";
import { useCollectionStats } from "@/store/collection-stats-selector";
import { useLocalCollectionStore } from "@/store/local-collection-store";
import { useVoteStore } from "@/store/vote-store";

type TonightSessionClientProps = {
  collectionId: string;
  collectionName: string;
};

export function TonightSessionClient({
  collectionId,
  collectionName,
}: TonightSessionClientProps) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const stats = useCollectionStats(collectionId);

  useEffect(() => {
    const finish = () => setHasHydrated(true);
    const unsubVotes = useVoteStore.persist.onFinishHydration(finish);
    const unsubLocal =
      useLocalCollectionStore.persist.onFinishHydration(finish);

    if (
      useVoteStore.persist.hasHydrated() &&
      useLocalCollectionStore.persist.hasHydrated()
    ) {
      queueMicrotask(finish);
    }

    return () => {
      unsubVotes();
      unsubLocal();
    };
  }, []);

  if (!hasHydrated) {
    return (
      <div className="mx-auto w-full max-w-lg py-8">
        <MovieDetailSkeleton />
      </div>
    );
  }

  return (
    <TonightSession
      collectionId={collectionId}
      collectionName={collectionName}
      matches={stats.mutualMatchMovies}
    />
  );
}
