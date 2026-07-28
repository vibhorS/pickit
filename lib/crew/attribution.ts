import type { RecommendationSource, User } from "@/lib/types";

/**
 * Subtle shared-recommendation attribution.
 * Example: "Added by Vibhor • Reddit"
 */
export function formatRecommendationAttribution(input: {
  addedByUserId?: string | null;
  addedAt?: string | null;
  source?: RecommendationSource | null;
  currentUserId: string;
  users: Array<Pick<User, "id" | "name">>;
}): string {
  const adder = input.users.find((user) => user.id === input.addedByUserId);
  const name =
    input.addedByUserId === input.currentUserId
      ? "you"
      : (adder?.name ?? "a member");
  const sourceLabel = input.source?.label?.trim();
  if (sourceLabel) {
    return `Added by ${name} • ${sourceLabel}`;
  }
  return `Added by ${name}`;
}

export function formatAddedOn(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
