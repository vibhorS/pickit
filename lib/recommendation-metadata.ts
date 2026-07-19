import type {
  RecommendationMetadata,
  RecommendationSource,
} from "@/lib/types";

export const RECOMMENDATION_PLATFORMS = [
  { type: "instagram", label: "Instagram" },
  { type: "reddit", label: "Reddit" },
  { type: "youtube", label: "YouTube" },
  { type: "friend", label: "Friend" },
  { type: "letterboxd", label: "Letterboxd" },
  { type: "imdb", label: "IMDb" },
  { type: "netflix", label: "Netflix" },
  { type: "whatsapp", label: "WhatsApp" },
  { type: "other", label: "Other" },
] as const;

export function sourceFromMetadata(
  metadata: RecommendationMetadata | undefined,
  fallback: RecommendationSource,
): RecommendationSource {
  const sourcePlatform = metadata?.sourcePlatform?.trim();
  if (!sourcePlatform) return fallback;

  const known = RECOMMENDATION_PLATFORMS.find(
    (platform) => platform.type === sourcePlatform.toLowerCase(),
  );

  return {
    type: known?.type ?? "other",
    label: known?.label ?? sourcePlatform,
  };
}

export function withSavedTimestamp(
  metadata: RecommendationMetadata | undefined,
  fallbackSource: RecommendationSource,
): RecommendationMetadata {
  return {
    sourcePlatform:
      metadata?.sourcePlatform?.trim() || fallbackSource.type,
    sourceUrl: metadata?.sourceUrl?.trim() || undefined,
    recommendedBy: metadata?.recommendedBy?.trim() || undefined,
    savedAt: metadata?.savedAt ?? new Date().toISOString(),
    notes: metadata?.notes?.trim() || undefined,
    captureMethod: metadata?.captureMethod,
  };
}

export function formatRelativeSavedDate(
  savedAt: string | undefined,
  prefix = "Saved",
): string | null {
  if (!savedAt) return null;
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const elapsedDays = Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / 86_400_000),
  );

  if (elapsedDays === 0) return `${prefix} today`;
  if (elapsedDays === 1) return `${prefix} yesterday`;
  if (elapsedDays < 7) return `${prefix} ${elapsedDays} days ago`;

  const weeks = Math.floor(elapsedDays / 7);
  if (elapsedDays < 30) {
    return `${prefix} ${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  }

  const months = Math.floor(elapsedDays / 30);
  if (elapsedDays < 365) {
    return `${prefix} ${months} ${months === 1 ? "month" : "months"} ago`;
  }

  const years = Math.floor(elapsedDays / 365);
  return `${prefix} ${years} ${years === 1 ? "year" : "years"} ago`;
}

export function formatWaitingTime(
  savedAt: string | undefined,
): string | null {
  const relative = formatRelativeSavedDate(savedAt, "Saved");
  if (!relative) return null;
  if (relative === "Saved today") return "Added to your list today";
  if (relative === "Saved yesterday") {
    return "Waiting in your list since yesterday";
  }
  const duration = relative
    .replace(/^Saved /, "")
    .replace(/ ago$/, "");
  return `Waiting in your list for ${duration}`;
}
