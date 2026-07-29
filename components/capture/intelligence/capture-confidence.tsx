"use client";

import { motion } from "framer-motion";
import {
  confidenceLabel,
  confidenceLevel,
  confidenceTone,
  type ConfidenceLevel,
} from "@/lib/capture/intelligence/ux-copy";
import type { MatchedRecommendation } from "@/lib/capture/intelligence/types";
import { Badge } from "@/components/ui/badge";
import { MOTION } from "@/lib/motion";

const DOT: Record<ConfidenceLevel, string> = {
  confident: "bg-emerald-400",
  "double-check": "bg-amber-300",
  "needs-review": "bg-red-400",
};

type ConfidenceBadgeProps = {
  value?: number | null;
  matchStatus?: MatchedRecommendation["matchStatus"];
  matchDecision?: MatchedRecommendation["matchDecision"];
  className?: string;
  /** Fade in when revealed. */
  animate?: boolean;
};

export function ConfidenceBadge({
  value,
  matchStatus,
  matchDecision,
  className = "",
  animate = true,
}: ConfidenceBadgeProps) {
  const level = confidenceLevel(value, matchStatus, matchDecision);
  const tone = confidenceTone(level);

  const inner = (
    <Badge tone={tone} className={`gap-1.5 ${className}`.trim()}>
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${DOT[level]}`}
      />
      {confidenceLabel(level)}
    </Badge>
  );

  if (!animate) return inner;

  return (
    <motion.span
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.durationSlow, ease: MOTION.ease, delay: 0.12 }}
      className="inline-flex"
    >
      {inner}
    </motion.span>
  );
}
