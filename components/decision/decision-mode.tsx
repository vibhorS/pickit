"use client";

import Link from "next/link";
import { useState } from "react";
import { DecisionCard } from "@/components/decision/decision-card";
import { MatchScreen } from "@/components/decision/match-screen";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getMutualMatches,
  type DecisionPhase,
  type DecisionUser,
} from "@/lib/decision-engine";
import type { Collection, Movie } from "@/lib/types";

type DecisionModeProps = {
  collection: Collection;
  movies: Movie[];
};

export function DecisionMode({ collection, movies }: DecisionModeProps) {
  const [phase, setPhase] = useState<DecisionPhase>("voting");
  const [currentUser, setCurrentUser] = useState<DecisionUser>("A");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userALikes, setUserALikes] = useState<string[]>([]);
  const [userBLikes, setUserBLikes] = useState<string[]>([]);

  const total = movies.length;
  const currentMovie = movies[currentIndex];
  const matches = getMutualMatches(movies, userALikes, userBLikes);

  function recordVote(liked: boolean) {
    if (!currentMovie) return;

    if (liked) {
      if (currentUser === "A") {
        setUserALikes((likes) =>
          likes.includes(currentMovie.id)
            ? likes
            : [...likes, currentMovie.id],
        );
      } else {
        setUserBLikes((likes) =>
          likes.includes(currentMovie.id)
            ? likes
            : [...likes, currentMovie.id],
        );
      }
    }

    const isLastMovie = currentIndex >= total - 1;

    if (!isLastMovie) {
      setCurrentIndex((index) => index + 1);
      return;
    }

    if (currentUser === "A") {
      setPhase("pass-phone");
      return;
    }

    setPhase("matches");
  }

  function startUserB() {
    setCurrentUser("B");
    setCurrentIndex(0);
    setPhase("voting");
  }

  if (total === 0) {
    return (
      <div className="mx-auto w-full max-w-md">
        <EmptyState
          emoji="🎬"
          title="Nothing to decide yet"
          description="Add a few movies to this collection first, then come back to start deciding."
        />
        <div className="mt-8 text-center">
          <Link
            href={`/collection/${collection.id}`}
            className="inline-block rounded-xl bg-netflix-red px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-red-hover"
          >
            Back to Collection
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "matches") {
    return <MatchScreen matches={matches} collectionId={collection.id} />;
  }

  if (phase === "pass-phone") {
    return (
      <div className="mx-auto w-full max-w-md text-center">
        <div className="rounded-2xl border border-white/10 bg-netflix-surface px-6 py-16 shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
          <div
            aria-hidden="true"
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-3xl"
          >
            📱
          </div>
          <h2 className="mt-5 text-3xl font-black tracking-tight text-white">
            Pass the phone.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-netflix-muted">
            User A is done. Hand the phone to User B to vote on the same
            movies.
          </p>
          <button
            type="button"
            onClick={startUserB}
            className="mt-8 rounded-xl bg-netflix-red px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-red-hover"
          >
            Start User B
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-6 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-netflix-red">
          Decision Mode · User {currentUser}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
          {collection.emoji} {collection.name}
        </h1>
        <p className="mt-3 text-sm text-netflix-muted">
          Movie {currentIndex + 1} of {total}
        </p>
        <div className="mx-auto mt-4 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-netflix-red"
            style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {currentMovie && (
        <DecisionCard
          movie={currentMovie}
          onLike={() => recordVote(true)}
          onPass={() => recordVote(false)}
        />
      )}

      <div className="mt-8 text-center">
        <Link
          href={`/collection/${collection.id}`}
          className="text-sm font-medium text-netflix-muted transition-colors hover:text-white"
        >
          ← Back to Collection
        </Link>
      </div>
    </div>
  );
}
