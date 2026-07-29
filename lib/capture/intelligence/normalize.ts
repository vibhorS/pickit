import type {
  CaptureContentType,
  RecommendationType,
  SceneUnderstanding,
  VisionExtraction,
  VisionRecommendation,
} from "@/lib/capture/intelligence/types";
import type { CaptureSource, CaptureSourceType } from "@/lib/capture/types";

function clamp01(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asYear(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const year = Math.round(value);
  if (year < 1888 || year > 2100) return null;
  return year;
}

function asInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value);
}

const SOURCE_TYPES: CaptureSourceType[] = [
  "instagram",
  "reddit",
  "youtube",
  "letterboxd",
  "imdb",
  "netflix",
  "tiktok",
  "twitter",
  "generic-url",
  "plain-text",
];

const RECOMMENDATION_TYPES: RecommendationType[] = [
  "ranked-list",
  "unranked-list",
  "single",
  "collage",
  "thread",
  "carousel-list",
  "caption",
  "unknown",
];

const CONTENT_TYPES: CaptureContentType[] = [
  "recommendation-list",
  "recommendation-thread",
  "review-card",
  "discussion-post",
  "unknown",
];

function asSourceGuess(value: unknown): CaptureSourceType | null {
  const raw = asString(value);
  if (!raw) return null;
  return SOURCE_TYPES.includes(raw as CaptureSourceType)
    ? (raw as CaptureSourceType)
    : null;
}

function asRecommendationType(value: unknown): RecommendationType {
  if (
    typeof value === "string" &&
    RECOMMENDATION_TYPES.includes(value as RecommendationType)
  ) {
    return value as RecommendationType;
  }
  return "unknown";
}

function asContentType(value: unknown): CaptureContentType {
  if (typeof value === "string" && CONTENT_TYPES.includes(value as CaptureContentType)) {
    return value as CaptureContentType;
  }
  return "unknown";
}

function asStringList(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, max);
}

export function normalizeRecommendation(
  raw: unknown,
  index: number,
  fallbackContext?: string | null,
): VisionRecommendation | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const title = asString(row.title);
  if (!title) return null;

  // Reject obvious UI / engagement noise that models sometimes leak.
  const lower = title.toLowerCase();
  if (
    /^(like|likes|comment|comments|share|follow|sponsored|view all|home|search|reels|profile)\b/.test(
      lower,
    ) ||
    /\b(likes|comments)\b/.test(lower) ||
    /^\d[\d,.]*\s*(likes|comments|views)\b/.test(lower)
  ) {
    return null;
  }

  const alternateTitles = asStringList(row.alternateTitles, 6);
  const mediaType =
    row.mediaType === "movie" ||
    row.mediaType === "tv" ||
    row.mediaType === "unknown"
      ? row.mediaType
      : "unknown";

  return {
    title,
    year: asYear(row.year),
    mediaType,
    rank:
      typeof row.rank === "number" && Number.isFinite(row.rank)
        ? Math.round(row.rank)
        : index + 1,
    context: asString(row.context) ?? fallbackContext ?? null,
    rawVisibleText: asString(row.rawVisibleText) ?? title,
    alternateTitles,
    confidence: clamp01(row.confidence),
  };
}

function pickFramingContext(
  headline: string | null,
  context: string | null,
): string | null {
  const candidates = [context, headline].filter(
    (value): value is string => Boolean(value),
  );
  if (candidates.length === 0) return null;

  const score = (value: string): number => {
    let s = 0;
    const lower = value.toLowerCase();
    if (/\btop\s*\d+\b/.test(lower)) s += 4;
    if (/\b(best|greatest|essential)\b/.test(lower)) s += 1;
    if (/\b(films?|movies?|shows?|series)\b/.test(lower)) s += 2;
    if (/\d/.test(lower)) s += 1;
    // Short decorative taglines score lower.
    if (value.length < 28) s -= 1;
    return s;
  };

  return [...candidates].sort((a, b) => score(b) - score(a))[0] ?? null;
}

export function normalizeSceneUnderstanding(raw: unknown): SceneUnderstanding {
  const row =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const headline = asString(row.headline);
  const context = pickFramingContext(headline, asString(row.context));

  return {
    headline: headline ?? context,
    sourceGuess: asSourceGuess(row.sourceGuess),
    contentType: asContentType(row.contentType),
    recommendationType: asRecommendationType(row.recommendationType),
    isRanked: Boolean(row.isRanked),
    isCarousel: Boolean(row.isCarousel),
    hasRecommendations:
      typeof row.hasRecommendations === "boolean"
        ? row.hasRecommendations
        : true,
    hasMoviePoster: Boolean(row.hasMoviePoster),
    hasTitleLikeText: Boolean(row.hasTitleLikeText),
    recommendationSignals: asStringList(row.recommendationSignals, 8),
    expectedCount: asInt(row.expectedCount),
    theme: asString(row.theme),
    mood: asString(row.mood),
    context,
    recommendationReason: asString(row.recommendationReason),
    collectionIdeas: asStringList(row.collectionIdeas, 8),
    ignoreHints: asStringList(row.ignoreHints, 16),
    confidence: clamp01(row.confidence),
    notes: asString(row.notes),
  };
}

export function normalizeExtractionPayload(
  raw: unknown,
  understanding?: SceneUnderstanding | null,
): VisionRecommendation[] {
  const row =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const fallbackContext = understanding?.context ?? understanding?.headline;
  const recommendations = Array.isArray(row.recommendations)
    ? row.recommendations
        .map((item, index) =>
          normalizeRecommendation(item, index, fallbackContext),
        )
        .filter((item): item is VisionRecommendation => Boolean(item))
    : [];

  // Preserve ranking order when Stage-1 said this is a ranked list.
  if (understanding?.isRanked) {
    return [...recommendations].sort((a, b) => {
      const ar = a.rank ?? Number.POSITIVE_INFINITY;
      const br = b.rank ?? Number.POSITIVE_INFINITY;
      return ar - br;
    });
  }
  return recommendations;
}

/**
 * Merge Stage-1 understanding + Stage-2 titles into the VisionExtraction
 * shape used by matching / UI.
 */
export function mergeVisionStages(
  understanding: SceneUnderstanding,
  extractionRaw: unknown,
): VisionExtraction {
  const row =
    extractionRaw && typeof extractionRaw === "object"
      ? (extractionRaw as Record<string, unknown>)
      : {};
  const recommendations = normalizeExtractionPayload(
    extractionRaw,
    understanding,
  );

  return {
    headline: understanding.headline ?? understanding.context,
    theme: understanding.theme,
    mood: understanding.mood,
    recommendationReason: understanding.recommendationReason,
    sourceGuess: understanding.sourceGuess,
    collectionIdeas: understanding.collectionIdeas,
    recommendations,
    confidence: clamp01(
      Math.min(understanding.confidence, clamp01(row.confidence)),
    ),
    notes: [understanding.notes, asString(row.notes)]
      .filter(Boolean)
      .join(" · ") || null,
    understanding,
  };
}

/** Legacy single-pass normalizer (understanding fields optional). */
export function normalizeVisionExtraction(raw: unknown): VisionExtraction {
  const row =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const understanding = normalizeSceneUnderstanding({
    headline: row.headline,
    sourceGuess: row.sourceGuess,
    contentType: row.contentType ?? "unknown",
    recommendationType: row.recommendationType ?? "unknown",
    isRanked: true,
    isCarousel: false,
    hasRecommendations: true,
    hasMoviePoster: false,
    hasTitleLikeText: false,
    recommendationSignals: [],
    expectedCount: Array.isArray(row.recommendations)
      ? row.recommendations.length
      : null,
    theme: row.theme,
    mood: row.mood,
    context: row.recommendationReason ?? row.headline,
    recommendationReason: row.recommendationReason,
    collectionIdeas: row.collectionIdeas,
    ignoreHints: [],
    confidence: row.confidence,
    notes: row.notes,
  });

  return mergeVisionStages(understanding, raw);
}

export function sourceFromVision(
  vision: VisionExtraction,
  sourceUrl?: string | null,
): CaptureSource {
  const type = vision.sourceGuess ?? (sourceUrl ? "generic-url" : "plain-text");
  const labels: Record<CaptureSourceType, string> = {
    instagram: "Instagram",
    reddit: "Reddit",
    youtube: "YouTube",
    letterboxd: "Letterboxd",
    imdb: "IMDb",
    netflix: "Netflix",
    tiktok: "TikTok",
    twitter: "X",
    "generic-url": "Web",
    "plain-text": "Text",
  };
  return {
    type,
    label: labels[type],
    url: sourceUrl ?? undefined,
  };
}
