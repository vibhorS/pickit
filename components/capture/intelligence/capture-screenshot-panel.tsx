"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Expand, X } from "lucide-react";
import { useState } from "react";
import { recommendationRegions } from "@/lib/capture/intelligence/ux-copy";
import type { MatchedRecommendation } from "@/lib/capture/intelligence/types";
import { MOTION } from "@/lib/motion";

type CaptureScreenshotPanelProps = {
  imageUrl: string;
  matches: MatchedRecommendation[];
  revealedCount: number;
  activeMatchId?: string | null;
  onSelectMatch?: (matchId: string) => void;
  compact?: boolean;
};

export function CaptureScreenshotPanel({
  imageUrl,
  matches,
  revealedCount,
  activeMatchId,
  onSelectMatch,
  compact = false,
}: CaptureScreenshotPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const regions = recommendationRegions(Math.max(revealedCount, matches.length));
  const showCount = Math.max(revealedCount, 0);

  const frame = (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/12 bg-black/40 shadow-[var(--shadow-elevated)] ${
        compact ? "aspect-[3/4] w-full max-w-[11rem]" : "aspect-[9/16] w-full max-w-xs"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Uploaded recommendation screenshot"
        className="h-full w-full object-cover object-top"
      />
      <div className="absolute inset-0">
        {regions.slice(0, showCount).map((region, index) => {
          const match = matches[index];
          if (!match) return null;
          const active = activeMatchId === match.id;
          return (
            <button
              key={match.id}
              type="button"
              aria-label={`Highlight ${match.movie?.title ?? match.extracted.title}`}
              onClick={() => onSelectMatch?.(match.id)}
              className={`absolute left-[6%] right-[6%] rounded-lg border transition ${
                active
                  ? "border-netflix-red bg-netflix-red/25 shadow-[0_0_0_1px_rgba(229,9,20,0.35)]"
                  : "border-white/25 bg-white/10 hover:bg-white/16"
              }`}
              style={{
                top: `${region.top * 100}%`,
                height: `${region.height * 100}%`,
              }}
            />
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition hover:bg-black/70"
      >
        <Expand className="h-3 w-3" />
        Expand
      </button>
    </div>
  );

  return (
    <>
      {frame}
      <AnimatePresence>
        {expanded ? (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: MOTION.duration, ease: MOTION.ease }}
            onClick={() => setExpanded(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.28, ease: MOTION.ease }}
              className="relative max-h-[88vh] w-full max-w-md overflow-hidden rounded-3xl border border-white/15 shadow-[var(--shadow-elevated)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Screenshot expanded"
                className="max-h-[88vh] w-full object-contain"
              />
              <div className="absolute inset-0">
                {regions.slice(0, showCount).map((region, index) => {
                  const match = matches[index];
                  if (!match) return null;
                  const active = activeMatchId === match.id;
                  return (
                    <button
                      key={match.id}
                      type="button"
                      onClick={() => {
                        onSelectMatch?.(match.id);
                        setExpanded(false);
                      }}
                      className={`absolute left-[6%] right-[6%] rounded-lg border ${
                        active
                          ? "border-netflix-red bg-netflix-red/30"
                          : "border-white/30 bg-white/10"
                      }`}
                      style={{
                        top: `${region.top * 100}%`,
                        height: `${region.height * 100}%`,
                      }}
                    >
                      <span className="absolute left-2 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                        {match.movie?.title ?? match.extracted.title}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
