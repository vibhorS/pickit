import {
  Bookmark,
  Camera,
  Clapperboard,
  Film,
  Globe2,
  MessageCircle,
  Music2,
  PenLine,
  Pin,
  Play,
  Search,
  Tv,
  Type,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { RecommendationSource } from "@/lib/types";

export const TMDB_SEARCH_SOURCE: RecommendationSource = {
  type: "search",
  label: "TMDb Search",
};

/**
 * Icon mapping by source.type.
 * Add a new entry here when introducing a source — no UI changes needed.
 */
const SOURCE_ICONS: Record<string, LucideIcon> = {
  search: Search,
  instagram: Camera,
  reddit: MessageCircle,
  whatsapp: MessageCircle,
  youtube: Play,
  friend: UserRound,
  imdb: Film,
  letterboxd: Bookmark,
  netflix: Tv,
  manual: PenLine,
  film: Clapperboard,
  tiktok: Music2,
  twitter: MessageCircle,
  "generic-url": Globe2,
  "plain-text": Type,
  other: Pin,
  skipped: Pin,
};

export function getSourceIcon(type: string): LucideIcon {
  return SOURCE_ICONS[type] ?? Pin;
}
