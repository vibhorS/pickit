import { Sparkles } from "lucide-react";
import { formatRelativeSavedDate, sourceFromMetadata } from "@/lib/recommendation-metadata";
import type { CollectionMovie } from "@/lib/services/movie-service";

type CollectionRecommendationInsightsProps = {
  items: CollectionMovie[];
};

function parseSavedAt(item: CollectionMovie): number | null {
  if (!item.metadata?.savedAt) return null;
  const timestamp = new Date(item.metadata.savedAt).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function CollectionRecommendationInsights({
  items,
}: CollectionRecommendationInsightsProps) {
  if (items.length === 0) return null;

  const sourceCounts = new Map<string, { label: string; count: number }>();
  let friendCount = 0;

  for (const item of items) {
    const source = sourceFromMetadata(item.metadata, item.source);
    const key = source.label.toLowerCase();
    const current = sourceCounts.get(key);
    sourceCounts.set(key, {
      label: source.label,
      count: (current?.count ?? 0) + 1,
    });
    if (
      source.type === "friend" ||
      item.metadata?.sourcePlatform?.toLowerCase() === "friend"
    ) {
      friendCount += 1;
    }
  }

  const mostCommon = [...sourceCounts.values()].sort(
    (left, right) => right.count - left.count,
  )[0];
  const datedItems = items
    .map((item) => ({ item, timestamp: parseSavedAt(item) }))
    .filter(
      (entry): entry is { item: CollectionMovie; timestamp: number } =>
        entry.timestamp !== null,
    )
    .sort((left, right) => left.timestamp - right.timestamp);

  const oldest = datedItems[0]?.item.metadata?.savedAt;
  const newest = datedItems.at(-1)?.item.metadata?.savedAt;
  const oldestRelative = formatRelativeSavedDate(oldest);
  const newestRelative = formatRelativeSavedDate(newest);
  const insights = [
    mostCommon
      ? `Most recommendations came from ${mostCommon.label}`
      : null,
    friendCount > 0
      ? `${friendCount} ${friendCount === 1 ? "recommendation" : "recommendations"} from friends`
      : null,
    oldestRelative
      ? oldestRelative === "Saved today"
        ? "Oldest recommendation was saved today"
        : oldestRelative === "Saved yesterday"
          ? "Oldest recommendation was saved yesterday"
          : `Oldest recommendation is ${oldestRelative
              .replace(/^Saved /, "")
              .replace(/ ago$/, "")} old`
      : null,
    newestRelative
      ? `Newest recommendation was ${newestRelative.toLowerCase()}`
      : null,
  ].filter((insight): insight is string => Boolean(insight));

  if (insights.length === 0) return null;

  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-white/[0.025] px-4 py-3.5 text-xs leading-relaxed text-netflix-muted">
      <Sparkles
        aria-hidden="true"
        className="mt-0.5 size-3.5 shrink-0 text-amber-300/70"
        strokeWidth={1.8}
      />
      <p>
        {insights.map((insight, index) => (
          <span key={insight}>
            {index > 0 && (
              <span aria-hidden="true" className="mx-2 text-white/20">
                •
              </span>
            )}
            {insight}
          </span>
        ))}
      </p>
    </div>
  );
}
