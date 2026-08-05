"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveRoundView } from "@/components/movie-night/live-round-view";
import { LiveRouletteView } from "@/components/movie-night/live-roulette-view";
import { WinnerScreen } from "@/components/movie-night/winner-screen";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { movieNightLiveService } from "@/lib/movie-night/live/service";
import type { MovieNightLiveSession } from "@/lib/movie-night/live/types";
import type { CollectionMovie } from "@/lib/services/movie-service";
import type { Movie } from "@/lib/types";

type SyncedMovieNightPlayProps = {
  session: MovieNightLiveSession;
  queueItems: CollectionMovie[];
  onSessionChange: (session: MovieNightLiveSession) => void;
  onExit: () => void;
};

export function SyncedMovieNightPlay({
  session,
  queueItems,
  onSessionChange,
  onExit,
}: SyncedMovieNightPlayProps) {
  const [myVote, setMyVote] = useState<"watch" | "pass" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashOutcome, setFlashOutcome] = useState<
    MovieNightLiveSession["lastOutcome"]
  >(null);
  const prevOutcomeKey = useRef<string | null>(null);
  const byId = useMemo(() => {
    const map = new Map<string, CollectionMovie>();
    for (const item of queueItems) map.set(item.movie.id, item);
    return map;
  }, [queueItems]);

  useEffect(() => {
    void movieNightLiveService.heartbeat(session.id);
    return movieNightLiveService.subscribe(session.id, onSessionChange);
  }, [onSessionChange, session.id]);

  useEffect(() => {
    const key = `${session.lastOutcome ?? ""}:${session.lastOutcomeMovieId ?? ""}:${session.updatedAt}`;
    if (
      session.lastOutcome &&
      session.lastOutcome !== "match" &&
      key !== prevOutcomeKey.current
    ) {
      prevOutcomeKey.current = key;
      setFlashOutcome(session.lastOutcome);
      const timer = window.setTimeout(() => setFlashOutcome(null), 1600);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [
    session.lastOutcome,
    session.lastOutcomeMovieId,
    session.updatedAt,
  ]);

  useEffect(() => {
    if (!session.currentMovieId || session.state !== "ROUND_ACTIVE") {
      setMyVote(null);
      return;
    }
    let cancelled = false;
    void movieNightLiveService
      .myVote(session.id, session.currentMovieId)
      .then((vote) => {
        if (!cancelled) setMyVote(vote);
      })
      .catch(() => {
        if (!cancelled) setMyVote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session.currentMovieId, session.id, session.state, session.updatedAt]);

  const handleVote = useCallback(
    async (vote: "watch" | "pass") => {
      if (!session.currentMovieId || myVote || busy) return;
      setBusy(true);
      setError(null);
      setMyVote(vote);
      try {
        const next = await movieNightLiveService.vote({
          sessionId: session.id,
          movieId: session.currentMovieId,
          vote,
        });
        onSessionChange(next);
      } catch (err) {
        setMyVote(null);
        setError(err instanceof Error ? err.message : "Could not submit vote.");
      } finally {
        setBusy(false);
      }
    },
    [busy, myVote, onSessionChange, session.currentMovieId, session.id],
  );

  const handleRouletteComplete = useCallback(async () => {
    try {
      const next = await movieNightLiveService.completeRoulette(session.id);
      onSessionChange(next);
    } catch {
      const refreshed = await movieNightLiveService.refresh(session.id);
      if (refreshed) onSessionChange(refreshed);
    }
  }, [onSessionChange, session.id]);

  const currentItem = session.currentMovieId
    ? byId.get(session.currentMovieId)
    : undefined;
  const winnerItem = session.winnerMovieId
    ? byId.get(session.winnerMovieId)
    : undefined;
  const rouletteMovies = session.maybeMovieIds
    .map((id) => byId.get(id)?.movie)
    .filter((movie): movie is Movie => Boolean(movie));

  if (session.state === "WINNER" && winnerItem) {
    const fromRoulette = session.rouletteSeed != null;
    return (
      <WinnerScreen
        movie={winnerItem.movie}
        source={winnerItem.source}
        metadata={winnerItem.metadata}
        addedByUserId={winnerItem.addedByUserId}
        onPickAgain={onExit}
        headline={fromRoulette ? "🎉 Tonight's Pick" : "✨ It's a Match ✨"}
        primaryLabel="Watch Tonight"
        exitLabel="End Session"
      />
    );
  }

  if (
    session.state === "ROULETTE" &&
    session.rouletteSeed != null &&
    rouletteMovies.length > 0
  ) {
    return (
      <LiveRouletteView
        movies={rouletteMovies}
        seed={session.rouletteSeed}
        startedAt={session.rouletteStartedAt ?? session.updatedAt}
        winnerId={session.winnerMovieId ?? rouletteMovies[0]!.id}
        onComplete={() => void handleRouletteComplete()}
      />
    );
  }

  if (session.state === "NO_MATCH" || session.state === "COMPLETE") {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center">
        <h1 className="text-3xl font-bold text-white">No matches tonight.</h1>
        <p className="mt-3 text-sm text-netflix-muted">
          Nobody landed on the same Watch. Start again when you&apos;re ready.
        </p>
        <Button className="mt-8" onClick={onExit}>
          Start Again
        </Button>
      </div>
    );
  }

  if (session.state === "ROUND_ACTIVE" && currentItem) {
    return (
      <FadeIn className="pb-10">
        {error ? (
          <p className="mb-4 text-center text-sm text-rose-400">{error}</p>
        ) : null}
        <LiveRoundView
          item={currentItem}
          hasVoted={Boolean(myVote)}
          busy={busy}
          flashOutcome={flashOutcome}
          onWatch={() => void handleVote("watch")}
          onPass={() => void handleVote("pass")}
        />
      </FadeIn>
    );
  }

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-5 text-center">
      <p className="text-sm text-netflix-muted">Syncing Movie Night…</p>
      {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
      <Button variant="ghost" className="mt-6" onClick={onExit}>
        Exit
      </Button>
    </div>
  );
}
