"use client";

import { useState } from "react";
import { MovieCard } from "@/components/movie/movie-card";
import type { Movie } from "@/lib/types";

type SwipeDeckProps = {
  movies: Movie[];
  onAdd?: (movie: Movie) => void;
  onPass?: (movie: Movie) => void;
};

export function SwipeDeck({ movies, onAdd, onPass }: SwipeDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentMovie = movies[currentIndex];

  function goToNextMovie() {
    setCurrentIndex((index) => index + 1);
  }

  function handleAdd(movie: Movie) {
    onAdd?.(movie);
    goToNextMovie();
  }

  function handlePass(movie: Movie) {
    onPass?.(movie);
    goToNextMovie();
  }

  if (!currentMovie) {
    return (
      <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-netflix-surface px-6 py-16 text-center shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        <div
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-3xl"
        >
          🍿
        </div>
        <p className="mt-5 text-2xl font-bold text-white">
          You&apos;re all caught up
        </p>
        <p className="mt-3 text-sm leading-relaxed text-netflix-muted">
          You’ve gone through every movie in this collection. Add more titles
          or revisit your bucket.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md justify-center">
      <MovieCard
        key={currentMovie.id}
        movie={currentMovie}
        onAdd={handleAdd}
        onPass={handlePass}
      />
    </div>
  );
}
