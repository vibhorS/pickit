import { mapTmdbResultToMovie } from "@/lib/map-tmdb-result";
import { tmdbService, type TmdbSearchMovie } from "@/lib/services/tmdb-service";
import type { Movie } from "@/lib/types";
import type {
  MatchedRecommendation,
  VisionRecommendation,
} from "@/lib/capture/intelligence/types";

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreCandidate(
  extracted: VisionRecommendation,
  hit: TmdbSearchMovie,
  queryUsed: string,
  queryRank: number,
): number {
  const extractedTitle = normalizeTitle(extracted.title);
  const hitTitle = normalizeTitle(hit.title);
  const query = normalizeTitle(queryUsed);

  let score = 0.34;

  if (hitTitle === extractedTitle || hitTitle === query) score += 0.48;
  else if (hitTitle.includes(extractedTitle) || extractedTitle.includes(hitTitle)) {
    score += 0.28;
  } else if (hitTitle.startsWith(extractedTitle.slice(0, 6))) {
    score += 0.12;
  }

  if (extracted.year && hit.releaseYear) {
    const delta = Math.abs(extracted.year - hit.releaseYear);
    if (delta === 0) score += 0.15;
    else if (delta === 1) score += 0.08;
    else if (delta <= 3) score += 0.02;
    else score -= 0.12;
  }

  // Popularity proxy from result rank + rating (soft prior).
  const positionBoost = Math.max(0, 0.08 - queryRank * 0.012);
  score += positionBoost;
  score += Math.min(0.07, (hit.rating / 10) * 0.07);
  const voteSignal = Math.min(1, Math.log10((hit.voteCount ?? 0) + 1) / 5);
  score += voteSignal * 0.08;

  const altHit = extracted.alternateTitles?.some(
    (alt) => normalizeTitle(alt) === hitTitle,
  );
  if (altHit) score += 0.2;

  return Math.min(0.99, Math.max(0.05, score));
}

function decideMatch(
  best: { score: number } | undefined,
  second: { score: number } | undefined,
): {
  decision: MatchedRecommendation["matchDecision"];
  status: MatchedRecommendation["matchStatus"];
  reason: string;
  dominanceGap: number;
} {
  if (!best) {
    return {
      decision: "not-found",
      status: "unmatched",
      reason: "No reliable TMDb candidates",
      dominanceGap: 0,
    };
  }

  const gap = Math.max(0, best.score - (second?.score ?? 0));
  const secondStrong = Boolean(second && second.score >= 0.72);

  if (best.score >= 0.84 && gap >= 0.14) {
    return {
      decision: "auto-selected",
      status: "matched",
      reason: "Best candidate is clearly dominant",
      dominanceGap: gap,
    };
  }

  if (best.score >= 0.78 && gap >= 0.1 && !secondStrong) {
    return {
      decision: "auto-selected",
      status: "matched",
      reason: "Strong candidate with healthy relevance gap",
      dominanceGap: gap,
    };
  }

  // Single-title captures can still be auto-selected with a smaller gap
  // when the best candidate confidence is very high.
  if (best.score >= 0.96 && gap >= 0.05) {
    return {
      decision: "auto-selected",
      status: "matched",
      reason: "Single clear candidate despite close alternatives",
      dominanceGap: gap,
    };
  }

  if (best.score >= 0.6) {
    return {
      decision: "manual-review",
      status: "ambiguous",
      reason: "Multiple plausible candidates need confirmation",
      dominanceGap: gap,
    };
  }

  return {
    decision: "not-found",
    status: "unmatched",
    reason: "Top candidate confidence is too weak",
    dominanceGap: gap,
  };
}

async function searchQueries(
  extracted: VisionRecommendation,
  contextHint?: string | null,
): Promise<Array<{ query: string; hits: TmdbSearchMovie[] }>> {
  const queries = [
    extracted.title,
    ...(extracted.alternateTitles ?? []),
    extracted.year ? `${extracted.title} ${extracted.year}` : null,
    // Context helps disambiguate (e.g. Scorsese) without inventing titles.
    contextHint ? `${extracted.title} ${contextHint}` : null,
  ].filter((value): value is string => Boolean(value?.trim()));

  const unique = Array.from(new Set(queries.map((q) => q.trim()))).slice(0, 4);
  const results: Array<{ query: string; hits: TmdbSearchMovie[] }> = [];

  for (const query of unique) {
    try {
      const hits = await tmdbService.searchMovies(query);
      results.push({ query, hits: hits.slice(0, 8) });
    } catch {
      results.push({ query, hits: [] });
    }
  }
  return results;
}

/**
 * Match extracted titles to TMDb.
 * Never silently guesses — unmatched / ambiguous stay explicit.
 */
export async function matchRecommendations(
  recommendations: VisionRecommendation[],
  options?: { contextHint?: string | null },
): Promise<MatchedRecommendation[]> {
  const matched: MatchedRecommendation[] = [];

  for (const extracted of recommendations) {
    const searches = await searchQueries(extracted, options?.contextHint);
    const scored = new Map<
      string,
      { movie: Movie; score: number; hit: TmdbSearchMovie; query: string }
    >();

    for (const { query, hits } of searches) {
      for (const [idx, hit] of hits.entries()) {
        const movie = mapTmdbResultToMovie(hit);
        const score = scoreCandidate(extracted, hit, query, idx);
        const existing = scored.get(movie.id);
        if (!existing || score > existing.score) {
          scored.set(movie.id, { movie, score, hit, query });
        }
      }
    }

    const ranked = Array.from(scored.values()).sort(
      (a, b) => b.score - a.score,
    );
    const best = ranked[0];
    const second = ranked[1];

    const decision = decideMatch(best, second);
    let movie: Movie | null = null;
    let matchConfidence = 0;
    if (best && decision.decision !== "not-found") {
      movie = best.movie;
      matchConfidence = best.score;
    }

    matched.push({
      id: createId("match"),
      extracted,
      movie,
      matchConfidence,
      matchDecision: decision.decision,
      decisionReason: decision.reason,
      dominanceGap: decision.dominanceGap,
      candidateCount: ranked.length,
      candidateDiagnostics: ranked.slice(0, 5).map((entry) => ({
        movieId: entry.movie.id,
        title: entry.movie.title,
        year: entry.movie.year,
        score: Number(entry.score.toFixed(4)),
        query: entry.query,
      })),
      matchStatus: decision.status,
      alternatives: ranked.slice(0, 5).map((entry) => entry.movie),
      selected: decision.decision === "auto-selected",
      rejected: false,
      alreadyInCollectionIds: [],
    });
  }

  return matched;
}

export function suggestCollections(
  theme: string | null | undefined,
  ideas: string[],
  existingNames: string[],
): string[] {
  const normalizedExisting = new Map(
    existingNames.map((name) => [normalizeTitle(name), name]),
  );
  const suggestions: string[] = [];

  const push = (raw: string | null | undefined) => {
    const value = raw?.trim();
    if (!value) return;
    const key = normalizeTitle(value);
    const existing = normalizedExisting.get(key);
    if (existing) {
      if (!suggestions.includes(existing)) suggestions.push(existing);
      return;
    }
    if (!suggestions.some((item) => normalizeTitle(item) === key)) {
      suggestions.push(value);
    }
  };

  push(theme);
  for (const idea of ideas) push(idea);

  return suggestions.slice(0, 6);
}
