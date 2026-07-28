import type { VoteValue } from "@/lib/types";

/** Compact glyph for a member's rating: ❤️ / ❌ / — */
export function getVoteGlyph(vote: VoteValue | undefined): string {
  if (vote === "like") return "❤️";
  if (vote === "pass") return "❌";
  return "—";
}
