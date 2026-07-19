"use client";

import { createElement, useState } from "react";
import { getSourceIcon } from "@/lib/recommendation-source";
import {
  RECOMMENDATION_PLATFORMS,
  withSavedTimestamp,
} from "@/lib/recommendation-metadata";
import type {
  RecommendationMetadata,
  RecommendationSource,
} from "@/lib/types";

type RecommendationContextFormProps = {
  initialPlatform?: string;
  initialPlatformLabel?: string;
  sourceUrl?: string;
  captureMethod: string;
  submitLabel?: string;
  busy?: boolean;
  error?: string | null;
  onBack?: () => void;
  onSubmit: (metadata: RecommendationMetadata) => void;
};

export function RecommendationContextForm({
  initialPlatform,
  initialPlatformLabel,
  sourceUrl,
  captureMethod,
  submitLabel = "Save Recommendation",
  busy = false,
  error,
  onBack,
  onSubmit,
}: RecommendationContextFormProps) {
  const knownInitial = RECOMMENDATION_PLATFORMS.find(
    (platform) => platform.type === initialPlatform?.toLowerCase(),
  );
  const [selected, setSelected] = useState(
    knownInitial?.type ?? (initialPlatform ? "other" : ""),
  );
  const [recommendedBy, setRecommendedBy] = useState("");
  const [otherSource, setOtherSource] = useState(
    knownInitial ? "" : initialPlatformLabel ?? "",
  );
  const [notes, setNotes] = useState("");

  function handleSubmit() {
    if (!selected) return;
    const selectedOption = RECOMMENDATION_PLATFORMS.find(
      (platform) => platform.type === selected,
    );
    const sourcePlatform =
      selected === "other"
        ? otherSource.trim() || "Other"
        : selectedOption?.type ?? selected;
    const fallback: RecommendationSource = {
      type: selected === "other" ? "other" : selected,
      label:
        selected === "other"
          ? otherSource.trim() || "Other"
          : selectedOption?.label ?? selected,
    };

    onSubmit(
      withSavedTimestamp(
        {
          sourcePlatform,
          sourceUrl,
          recommendedBy:
            selected === "friend" ? recommendedBy : undefined,
          notes,
          captureMethod,
        },
        fallback,
      ),
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {onBack && (
        <button type="button" onClick={onBack} className="btn-ghost -ml-3">
          ← Back
        </button>
      )}

      <div className="mt-7">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-netflix-red">
          Recommendation Context
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          How did you discover this?
        </h1>
        <p className="mt-2 text-sm text-netflix-muted">
          Add the part you&apos;ll want to remember later.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {RECOMMENDATION_PLATFORMS.map((platform) => {
          const active = selected === platform.type;
          const icon = createElement(getSourceIcon(platform.type), {
            className: "size-3.5",
            strokeWidth: 2,
            "aria-hidden": true,
          });
          return (
            <button
              key={platform.type}
              type="button"
              onClick={() => setSelected(platform.type)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                active
                  ? "bg-netflix-red text-white"
                  : "bg-white/[0.05] text-netflix-muted hover:bg-white/[0.09] hover:text-white"
              }`}
            >
              {icon}
              {platform.label}
            </button>
          );
        })}
      </div>

      {selected === "friend" && (
        <div className="mt-5">
          <label
            htmlFor="recommended-by"
            className="text-sm font-medium text-white"
          >
            Who recommended it?
          </label>
          <input
            id="recommended-by"
            value={recommendedBy}
            onChange={(event) => setRecommendedBy(event.target.value)}
            placeholder="Rahul, Neha, Mum…"
            maxLength={60}
            autoFocus
            className="mt-2 w-full rounded-xl bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-netflix-muted focus:ring-2 focus:ring-netflix-red/60"
          />
        </div>
      )}

      {selected === "other" && (
        <div className="mt-5">
          <label
            htmlFor="other-source"
            className="text-sm font-medium text-white"
          >
            Where did you find it?
          </label>
          <input
            id="other-source"
            value={otherSource}
            onChange={(event) => setOtherSource(event.target.value)}
            placeholder="Podcast, newsletter, film club…"
            maxLength={60}
            autoFocus
            className="mt-2 w-full rounded-xl bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-netflix-muted focus:ring-2 focus:ring-netflix-red/60"
          />
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="recommendation-note" className="text-sm font-medium text-white">
            Personal note <span className="font-normal text-netflix-muted">(optional)</span>
          </label>
          <span className="text-xs text-netflix-muted">{notes.length}/160</span>
        </div>
        <textarea
          id="recommendation-note"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Everyone says the ending is insane."
          maxLength={160}
          rows={3}
          className="mt-2 w-full resize-none rounded-xl bg-white/[0.05] px-4 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-netflix-muted focus:ring-2 focus:ring-netflix-red/60"
        />
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={busy || !selected}
        onClick={handleSubmit}
        className="btn-primary mt-6 w-full sm:w-auto"
      >
        {busy ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}
