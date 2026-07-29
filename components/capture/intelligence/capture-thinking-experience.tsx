"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { CaptureScreenshotPanel } from "@/components/capture/intelligence/capture-screenshot-panel";
import { PosterImage } from "@/components/ui/poster-image";
import { ConfidenceBadge } from "@/components/capture/intelligence/capture-confidence";
import {
  THINKING_STAGES,
  type ThinkingStageId,
} from "@/lib/capture/intelligence/ux-copy";
import type { MatchedRecommendation } from "@/lib/capture/intelligence/types";
import { MOTION } from "@/lib/motion";

type CaptureThinkingExperienceProps = {
  stage: ThinkingStageId;
  observation: string;
  imageUrl?: string | null;
  matches: MatchedRecommendation[];
  revealedCount: number;
  activeMatchId?: string | null;
  onSelectMatch?: (matchId: string) => void;
};

export function CaptureThinkingExperience({
  stage,
  observation,
  imageUrl,
  matches,
  revealedCount,
  activeMatchId,
  onSelectMatch,
}: CaptureThinkingExperienceProps) {
  const stageIndex = THINKING_STAGES.findIndex((s) => s.id === stage);
  const active = THINKING_STAGES[stageIndex] ?? THINKING_STAGES[0];
  const revealed = matches.slice(0, revealedCount);

  useEffect(() => {
    // Prefetch posters as they become known (even before reveal).
    for (const match of matches) {
      const url = match.movie?.posterUrl;
      if (!url || typeof window === "undefined") continue;
      const img = new window.Image();
      img.src = url;
    }
  }, [matches]);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] lg:items-start">
      <div className="flex flex-col items-center lg:items-start">
        {imageUrl ? (
          <motion.div
            layoutId="capture-screenshot-card"
            className="w-full max-w-[14rem]"
            transition={{ duration: 0.45, ease: MOTION.ease }}
          >
            <CaptureScreenshotPanel
              imageUrl={imageUrl}
              matches={matches}
              revealedCount={revealedCount}
              activeMatchId={activeMatchId}
              onSelectMatch={onSelectMatch}
            />
          </motion.div>
        ) : (
          <div className="aspect-[9/16] w-full max-w-[14rem] rounded-2xl border border-dashed border-white/15 bg-white/[0.03]" />
        )}
      </div>

      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-netflix-red">
          Capture
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: MOTION.ease }}
            className="mt-4"
          >
            <p className="text-3xl leading-none" aria-hidden>
              {active.emoji}
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {active.label}
            </h2>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.p
            key={observation}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: MOTION.ease }}
            className="mt-3 max-w-md text-base leading-relaxed text-netflix-muted"
          >
            {observation}
          </motion.p>
        </AnimatePresence>

        <ol className="mt-8 space-y-2.5">
          {THINKING_STAGES.map((item, index) => {
            const done = index < stageIndex;
            const current = index === stageIndex;
            return (
              <li key={item.id}>
                <motion.div
                  layout
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                    current
                      ? "border-netflix-red/35 bg-netflix-red/10"
                      : done
                        ? "border-white/10 bg-white/[0.04]"
                        : "border-transparent bg-transparent opacity-40"
                  }`}
                  transition={{ duration: MOTION.duration, ease: MOTION.ease }}
                >
                  <span className="text-base" aria-hidden>
                    {item.emoji}
                  </span>
                  <span
                    className={`text-sm ${
                      current ? "font-semibold text-white" : "text-netflix-muted"
                    }`}
                  >
                    {item.label}
                  </span>
                  {current ? (
                    <motion.span
                      className="ml-auto h-1.5 w-1.5 rounded-full bg-netflix-red"
                      animate={{ opacity: [0.35, 1, 0.35] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                    />
                  ) : null}
                </motion.div>
              </li>
            );
          })}
        </ol>

        {revealed.length > 0 ? (
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-netflix-muted">
              Appearing now
            </p>
            <ul className="mt-3 flex gap-3 overflow-x-auto pb-2">
              <AnimatePresence initial={false}>
                {revealed.map((match, index) => (
                  <motion.li
                    key={match.id}
                    layout
                    initial={{ opacity: 0, scale: 0.86, y: 14 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{
                      duration: 0.34,
                      ease: MOTION.ease,
                      delay: 0.02,
                    }}
                    className={`w-24 shrink-0 overflow-hidden rounded-xl border bg-white/[0.04] ${
                      activeMatchId === match.id
                        ? "border-netflix-red/50"
                        : "border-white/10"
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => onSelectMatch?.(match.id)}
                    >
                      <div className="aspect-[2/3] w-full">
                        {match.movie?.posterUrl ? (
                          <PosterImage
                            src={match.movie.posterUrl}
                            alt={match.movie.title}
                            priority={index < 3}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-netflix-elevated px-1 text-center text-[10px] text-netflix-muted">
                            {match.extracted.title}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 p-2">
                        <p className="truncate text-[11px] font-medium text-white">
                          {match.movie?.title ?? match.extracted.title}
                        </p>
                        <ConfidenceBadge
                          value={match.matchConfidence}
                          matchStatus={match.matchStatus}
                          matchDecision={match.matchDecision}
                        />
                      </div>
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
