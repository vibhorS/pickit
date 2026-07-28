"use client";

import {
  Check,
  Copy,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { createElement, useMemo, useState } from "react";
import { ManualMovieSearch } from "@/components/capture/pipeline/manual-movie-search";
import { PosterImage } from "@/components/ui/poster-image";
import { mapTmdbResultToMovie } from "@/lib/map-tmdb-result";
import { getSourceIcon } from "@/lib/recommendation-source";
import type {
  CaptureSession,
  MovieCandidate,
} from "@/lib/capture/types";
import type { TmdbSearchMovie } from "@/lib/services/tmdb-service";
import type { Movie } from "@/lib/types";

type CaptureReviewStepProps = {
  session: CaptureSession;
  candidates: MovieCandidate[];
  readOnly?: boolean;
  onChange?: (candidates: MovieCandidate[]) => void;
  onBack: () => void;
  onContinue?: () => void;
};

function createCandidate(movie: Movie): MovieCandidate {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: `candidate-${suffix}`,
    movie,
    confidence: 1,
    selected: true,
    matchedText: movie.title,
  };
}

function duplicateKey(candidate: MovieCandidate): string {
  return `${candidate.movie.title.toLowerCase().trim()}-${candidate.movie.year}`;
}

export function CaptureReviewStep({
  session,
  candidates,
  readOnly = false,
  onChange,
  onBack,
  onContinue,
}: CaptureReviewStepProps) {
  const [manualSearchOpen, setManualSearchOpen] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const sourceIcon = createElement(
    getSourceIcon(session.result.source.type),
    {
      className: "size-4",
      strokeWidth: 1.8,
    },
  );
  const selectedCount = candidates.filter(
    (candidate) => candidate.selected,
  ).length;

  const duplicateCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const candidate of candidates) {
      const key = duplicateKey(candidate);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.values()).reduce(
      (total, count) => total + Math.max(0, count - 1),
      0,
    );
  }, [candidates]);

  function updateCandidate(
    candidateId: string,
    update: (candidate: MovieCandidate) => MovieCandidate,
  ) {
    onChange?.(
      candidates.map((candidate) =>
        candidate.id === candidateId ? update(candidate) : candidate,
      ),
    );
  }

  async function retrySearch(candidate: MovieCandidate) {
    setRetryingId(candidate.id);
    try {
      const response = await fetch(
        `/api/search-movies?q=${encodeURIComponent(candidate.movie.title)}`,
      );
      if (!response.ok) return;
      const results = (await response.json()) as TmdbSearchMovie[];
      const match = results[0];
      if (!match) return;
      updateCandidate(candidate.id, (current) => ({
        ...current,
        movie: mapTmdbResultToMovie(match),
        confidence: 0.98,
        selected: true,
      }));
    } catch {
      // Keep the current candidate when TMDb is unavailable.
    } finally {
      setRetryingId(null);
    }
  }

  function mergeDuplicates() {
    const merged = new Map<string, MovieCandidate>();
    for (const candidate of candidates) {
      const key = duplicateKey(candidate);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, candidate);
        continue;
      }
      merged.set(key, {
        ...existing,
        selected: existing.selected || candidate.selected,
        confidence: Math.max(existing.confidence, candidate.confidence),
        mergedCandidateIds: [
          ...(existing.mergedCandidateIds ?? []),
          candidate.id,
        ],
      });
    }
    onChange?.(Array.from(merged.values()));
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <button type="button" onClick={onBack} className="btn-ghost -ml-3">
        ← {readOnly ? "Capture History" : "Start over"}
      </button>

      <div className="mt-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-netflix-muted">
            {sourceIcon}
            {session.result.source.label}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {readOnly
              ? "Capture summary"
              : `We found ${candidates.length} possible ${
                  candidates.length === 1 ? "movie" : "movies"
                }.`}
          </h1>
          <p className="mt-2 text-sm text-netflix-muted">
            {readOnly
              ? `${session.approvedCandidateIds.length} approved movies · ${
                  session.collectionIds.length
                } ${
                  session.collectionIds.length === 1
                    ? "list"
                    : "lists"
                }`
              : "Review every match. Nothing is saved until you approve it."}
          </p>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setManualSearchOpen(true)}
              className="btn-secondary gap-2 px-4"
            >
              <Search className="size-4" />
              Manual Search
            </button>
            <button
              type="button"
              disabled={duplicateCount === 0}
              onClick={mergeDuplicates}
              className="btn-ghost gap-2 px-4"
            >
              <Copy className="size-4" />
              {duplicateCount === 1 ? "Merge duplicate" : "Merge duplicates"}
              {duplicateCount > 0 ? ` (${duplicateCount})` : ""}
            </button>
          </div>
        )}
      </div>

      <details className="mt-5 rounded-xl bg-white/[0.025] px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-netflix-muted">
          Original content
        </summary>
        <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed text-netflix-muted/80">
          {session.result.originalContent}
        </p>
      </details>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {candidates.map((candidate) => (
          <li
            key={candidate.id}
            className={`rounded-2xl border p-3 transition ${
              candidate.selected
                ? "border-white/10 bg-white/[0.04]"
                : "border-white/5 bg-white/[0.02] opacity-65"
            }`}
          >
            <div className="flex gap-3">
              {!readOnly && (
                <button
                  type="button"
                  onClick={() =>
                    updateCandidate(candidate.id, (current) => ({
                      ...current,
                      selected: !current.selected,
                    }))
                  }
                  aria-label={`${candidate.selected ? "Deselect" : "Select"} ${
                    candidate.movie.title
                  }`}
                  className={`mt-1 flex size-6 shrink-0 items-center justify-center rounded-md border ${
                    candidate.selected
                      ? "border-netflix-red bg-netflix-red text-white"
                      : "border-white/20 text-transparent"
                  }`}
                >
                  <Check className="size-4" strokeWidth={2.5} />
                </button>
              )}

              <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg">
                <PosterImage
                  src={candidate.movie.posterUrl}
                  alt={`${candidate.movie.title} poster`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="line-clamp-2 font-semibold leading-snug text-white">
                  {candidate.movie.title}
                </h2>
                <p className="mt-1 text-xs text-netflix-muted">
                  {candidate.movie.year || "Year unknown"}
                </p>
                <span
                  className={`mt-2 inline-flex rounded-full px-2 py-1 text-[0.6875rem] font-semibold ${
                    candidate.confidence >= 0.8
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-amber-500/15 text-amber-200"
                  }`}
                >
                  {Math.round(candidate.confidence * 100)}% confidence
                </span>
              </div>
            </div>

            {!readOnly && (
              <div className="mt-3 flex gap-2 border-t border-white/5 pt-2">
                <button
                  type="button"
                  disabled={retryingId === candidate.id}
                  onClick={() => retrySearch(candidate)}
                  className="btn-ghost min-h-9 flex-1 gap-1.5 px-2 text-xs"
                >
                  <RefreshCw
                    className={`size-3.5 ${
                      retryingId === candidate.id ? "animate-spin" : ""
                    }`}
                  />
                  Retry Search
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange?.(
                      candidates.filter((item) => item.id !== candidate.id),
                    )
                  }
                  className="btn-ghost min-h-9 gap-1.5 px-2 text-xs text-red-300"
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {!readOnly && candidates.length === 0 && (
        <div className="mt-6 rounded-2xl bg-white/[0.03] px-5 py-10 text-center">
          <p className="text-sm text-netflix-muted">
            No candidates remain. Search manually to add one.
          </p>
          <button
            type="button"
            onClick={() => setManualSearchOpen(true)}
            className="btn-secondary mt-4 gap-2"
          >
            <Plus className="size-4" />
            Manual Search
          </button>
        </div>
      )}

      {!readOnly && (
        <div className="sticky bottom-4 mt-8 rounded-2xl border border-white/10 bg-netflix-surface/95 p-3 shadow-[var(--shadow-elevated)] backdrop-blur">
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={onContinue}
            className="btn-primary w-full"
          >
            Choose Lists · {selectedCount} selected
          </button>
        </div>
      )}

      <ManualMovieSearch
        open={manualSearchOpen}
        onClose={() => setManualSearchOpen(false)}
        onAdd={(movie) => {
          const existing = candidates.some(
            (candidate) => candidate.movie.id === movie.id,
          );
          if (!existing) onChange?.([...candidates, createCandidate(movie)]);
        }}
      />
    </div>
  );
}
