import { describe, expect, it } from "vitest";
import { AIService } from "@/lib/ai/ai-service";
import type { AICompletionRequest, AICompletionResult, AIProvider } from "@/lib/ai/types";
import { analyzeCapture } from "@/lib/capture/intelligence/vision-service";

class RecoveryFixtureProvider implements AIProvider {
  readonly id = "openai" as const;
  private call = 0;

  isConfigured(): boolean {
    return true;
  }

  async complete(_request: AICompletionRequest): Promise<AICompletionResult> {
    this.call += 1;
    const json =
      this.call === 1
        ? {
            headline: "The Odyssey",
            sourceGuess: "generic-url",
            contentType: "review-card",
            recommendationType: "single",
            isRanked: false,
            isCarousel: false,
            hasRecommendations: false,
            hasMoviePoster: true,
            hasTitleLikeText: true,
            recommendationSignals: ["full-screen movie poster", "single title card"],
            expectedCount: null,
            theme: "Adventure",
            mood: "Epic",
            context: "Movie poster recommendation",
            recommendationReason: null,
            collectionIdeas: ["Adventure"],
            ignoreHints: [],
            confidence: 0.82,
            notes: null,
          }
        : {
            recommendations: [
              {
                title: "The Odyssey",
                year: null,
                mediaType: "movie",
                rank: 1,
                context: "Movie poster recommendation",
                rawVisibleText: "The Odyssey",
                alternateTitles: [],
                confidence: 0.88,
              },
            ],
            confidence: 0.86,
            notes: "Recovered from poster signal.",
          };

    return {
      text: JSON.stringify(json),
      json,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: "fixture-recovery",
      provider: this.id,
      latencyMs: 1,
    };
  }
}

describe("vision recovery pass", () => {
  it("runs recovery extraction when stage-1 sees poster/title signals", async () => {
    process.env.TMDB_API_KEY ??= "test-tmdb-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.themoviedb.org")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: 1368337,
                title: "The Odyssey",
                poster_path: null,
                release_date: "2026-01-01",
                overview: "",
                vote_average: 8.0,
                genre_ids: [12],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return originalFetch(input);
    }) as typeof fetch;

    try {
      const result = await analyzeCapture(
        { imageDataUrl: "data:image/png;base64,AAAA" },
        { ai: new AIService(new RecoveryFixtureProvider()) },
      );

      expect(result.vision.recommendations).toHaveLength(1);
      expect(result.reliability?.recoveryPassUsed).toBe(true);
      expect(result.rawAiOutput).toMatchObject({ recoveryPassUsed: true });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
