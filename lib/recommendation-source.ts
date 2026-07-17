import type { RecommendationSource } from "@/lib/types";

export const TMDB_SEARCH_SOURCE: RecommendationSource = {
  type: "search",
  label: "TMDb Search",
};

/**
 * Icon mapping by source.type.
 * Add a new entry here when introducing a source — no UI changes needed.
 */
const SOURCE_ICONS: Record<string, string> = {
  search: "🔍",
  instagram: "📸",
  reddit: "💬",
  youtube: "▶️",
  friend: "👤",
  imdb: "🎬",
  letterboxd: "🎬",
  netflix: "🍿",
  manual: "📝",
};

export function getSourceIcon(type: string): string {
  return SOURCE_ICONS[type] ?? "📌";
}
