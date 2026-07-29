import type { CaptureItem, MatchedRecommendation } from "@/lib/capture/intelligence/types";
import type { CaptureSourceType } from "@/lib/capture/types";

export type ConfidenceLevel = "confident" | "double-check" | "needs-review";

export function confidenceLevel(
  value: number | null | undefined,
  matchStatus?: MatchedRecommendation["matchStatus"],
  matchDecision?: MatchedRecommendation["matchDecision"],
): ConfidenceLevel {
  if (matchDecision === "not-found") return "needs-review";
  if (matchDecision === "manual-review") return "double-check";
  if (matchDecision === "auto-selected") return "confident";
  if (matchStatus === "unmatched") return "needs-review";
  if (matchStatus === "ambiguous") return "double-check";
  if (typeof value !== "number") return "double-check";
  if (value >= 0.78) return "confident";
  if (value >= 0.58) return "double-check";
  return "needs-review";
}

export function confidenceLabel(level: ConfidenceLevel): string {
  if (level === "confident") return "Ready";
  if (level === "double-check") return "Double-check";
  return "Not found";
}

export function confidenceTone(
  level: ConfidenceLevel,
): "success" | "warning" | "danger" {
  if (level === "confident") return "success";
  if (level === "double-check") return "warning";
  return "danger";
}

const SOURCE_OBSERVATIONS: Partial<Record<CaptureSourceType, string>> = {
  instagram: "This looks like an Instagram recommendation.",
  reddit: "This looks like a Reddit recommendation thread.",
  youtube: "This feels like a YouTube recommendation.",
  letterboxd: "Looks like a Letterboxd list.",
  twitter: "This looks like a recommendation from X.",
  tiktok: "Looks like a TikTok recommendation.",
  netflix: "This looks Netflix-related.",
  imdb: "Looks like an IMDb list.",
  "generic-url": "Looks like a recommendation from the web.",
  "plain-text": "Looks like a pasted recommendation list.",
};

/** Observational, never robotic. */
export function buildObservation(
  item: Pick<
    CaptureItem,
    "theme" | "mood" | "headline" | "detectedCount" | "source" | "vision"
  >,
  phase:
    | "reading"
    | "understanding"
    | "matching"
    | "organizing"
    | "ready"
    | "revealing",
  revealedCount = 0,
): string {
  const theme = item.theme?.trim();
  const mood = item.mood?.trim();
  const count = item.detectedCount || item.vision?.recommendations.length || 0;
  const sourceLine = SOURCE_OBSERVATIONS[item.source.type];

  if (phase === "reading") {
    return sourceLine ?? "Looking closely at what you captured…";
  }

  if (phase === "understanding") {
    if (theme && mood) {
      return `Looks like a list of ${mood.toLowerCase()} ${theme.toLowerCase()} picks.`;
    }
    if (theme) {
      return `Looks like a list of ${theme.toLowerCase()} recommendations.`;
    }
    if (item.headline) {
      return `Reading “${item.headline}”…`;
    }
    return sourceLine ?? "Figuring out what was recommended…";
  }

  if (phase === "matching" || phase === "revealing") {
    if (revealedCount > 0 && count > 0) {
      return `Found ${revealedCount} of ${count}…`;
    }
    if (count > 0) {
      return `I found ${count} recommendation${count === 1 ? "" : "s"}.`;
    }
    return "Matching titles to real movies…";
  }

  if (phase === "organizing") {
    if (theme) {
      return `Organizing your ${theme.toLowerCase()} picks…`;
    }
    return "Organizing your picks…";
  }

  // ready
  if (count > 0 && theme) {
    return `I found ${count} recommendation${count === 1 ? "" : "s"} — ${theme.toLowerCase()}.`;
  }
  if (count > 0) {
    return `I found ${count} recommendation${count === 1 ? "" : "s"}.`;
  }
  if (item.headline) return item.headline;
  return sourceLine ?? "Ready when you are.";
}

export type ThinkingStageId =
  | "reading"
  | "understanding"
  | "matching"
  | "organizing";

export const THINKING_STAGES: Array<{
  id: ThinkingStageId;
  emoji: string;
  label: string;
  /** Minimum time on this stage — never skip instantly. */
  minMs: number;
}> = [
  {
    id: "reading",
    emoji: "👀",
    label: "Reading recommendation…",
    minMs: 1100,
  },
  {
    id: "understanding",
    emoji: "🧠",
    label: "Understanding what was recommended…",
    minMs: 1300,
  },
  {
    id: "matching",
    emoji: "🎬",
    label: "Matching movies…",
    minMs: 900,
  },
  {
    id: "organizing",
    emoji: "✨",
    label: "Organizing your picks…",
    minMs: 900,
  },
];

/** Approximate vertical bands for N recommendations (trust UI, no backend boxes). */
export function recommendationRegions(count: number): Array<{
  top: number;
  height: number;
}> {
  if (count <= 0) return [];
  const pad = 0.06;
  const usable = 1 - pad * 2;
  const height = usable / count;
  return Array.from({ length: count }, (_, i) => ({
    top: pad + i * height,
    height: height * 0.92,
  }));
}
