"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CAPTURE_PROCESSING_STAGES,
  type CaptureProcessingStage,
  type CaptureProcessingStatus,
} from "@/lib/capture/intelligence/types";
import { MOTION } from "@/lib/motion";

const STAGE_COPY: Record<CaptureProcessingStage, string> = {
  reading: "Reading screenshot",
  understanding: "Understanding recommendations",
  matching: "Matching movies",
  "checking-duplicates": "Checking duplicates",
  preparing: "Preparing import",
};

function statusToStageIndex(status: CaptureProcessingStatus): number {
  if (status === "queued") return -1;
  if (status === "reading") return 0;
  if (status === "understanding") return 1;
  if (status === "matching") return 2;
  if (status === "checking-duplicates") return 3;
  if (status === "preparing") return 4;
  return 5;
}

type CaptureProcessingProps = {
  status: CaptureProcessingStatus;
  headline?: string | null;
};

export function CaptureProcessing({ status, headline }: CaptureProcessingProps) {
  const activeIndex = statusToStageIndex(status);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-2 py-16 text-center">
      <motion.div
        className="relative mb-10 h-28 w-28"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: MOTION.durationSlow, ease: MOTION.ease }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-netflix-red/30 via-white/5 to-transparent blur-xl" />
        <div className="absolute inset-3 overflow-hidden rounded-full border border-white/15 bg-netflix-surface">
          <motion.div
            className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-netflix-red/40 to-transparent"
            animate={{ top: ["-30%", "110%"] }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </div>
      </motion.div>

      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-netflix-red">
        Capture Intelligence
      </p>
      <AnimatePresence mode="wait">
        <motion.h2
          key={status}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: MOTION.duration, ease: MOTION.ease }}
          className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl"
        >
          {activeIndex >= 0 && activeIndex < CAPTURE_PROCESSING_STAGES.length
            ? STAGE_COPY[CAPTURE_PROCESSING_STAGES[activeIndex]]
            : status === "ready"
              ? "Ready to review"
              : "Getting started"}
        </motion.h2>
      </AnimatePresence>
      {headline ? (
        <p className="mt-3 max-w-sm text-sm text-netflix-muted">{headline}</p>
      ) : (
        <p className="mt-3 max-w-sm text-sm text-netflix-muted">
          PickIt is reading the recommendation — not just the pixels.
        </p>
      )}

      <ol className="mt-10 w-full space-y-3 text-left">
        {CAPTURE_PROCESSING_STAGES.map((stage, index) => {
          const done = index < activeIndex;
          const current = index === activeIndex;
          return (
            <li
              key={stage}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                current
                  ? "border-netflix-red/40 bg-netflix-red/10"
                  : done
                    ? "border-white/10 bg-white/[0.04]"
                    : "border-white/5 bg-transparent opacity-45"
              }`}
            >
              <span
                className={`flex h-2.5 w-2.5 shrink-0 rounded-full ${
                  current
                    ? "animate-pulse bg-netflix-red"
                    : done
                      ? "bg-emerald-400"
                      : "bg-white/20"
                }`}
              />
              <span
                className={`text-sm ${
                  current ? "font-semibold text-white" : "text-netflix-muted"
                }`}
              >
                {STAGE_COPY[stage]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
