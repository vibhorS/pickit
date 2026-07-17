"use client";

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
  const votes = useVoteStore((state) => state.votes);
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
