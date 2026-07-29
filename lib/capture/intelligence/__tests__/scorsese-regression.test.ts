import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { AIService, setAIServiceForTests } from "@/lib/ai/ai-service";
import type {
  AICompletionRequest,
  AICompletionResult,
  AIProvider,
} from "@/lib/ai/types";
import { analyzeCapture } from "@/lib/capture/intelligence/vision-service";

const FIXTURE_DIR = path.resolve(
  process.cwd(),
  "fixtures/capture/scorsese-instagram",
);

type ExpectedFixture = {
  expectedContext: string;
  expectedSource: string;
  expectedCount: number;
  rankedTitles: Array<{ rank: number; title: string; year: number }>;
  forbiddenTitles: string[];
};

function loadExpected(): ExpectedFixture {
  return JSON.parse(
    fs.readFileSync(path.join(FIXTURE_DIR, "expected.json"), "utf8"),
  ) as ExpectedFixture;
}

function imageDataUrl(): string {
  const bytes = fs.readFileSync(path.join(FIXTURE_DIR, "screenshot.png"));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Deterministic two-stage provider for offline regression.
 * Mimics a correct semantic (not OCR) response for the Scorsese fixture.
 */
class FixtureTwoStageProvider implements AIProvider {
  readonly id = "openai" as const;
  private call = 0;

  constructor(private readonly expected: ExpectedFixture) {}

  isConfigured(): boolean {
    return true;
  }

  async complete(
    request: AICompletionRequest,
  ): Promise<AICompletionResult> {
    this.call += 1;
    const schemaName = request.jsonSchema?.name ?? "";
    let json: unknown;

    if (
      schemaName.includes("understanding") ||
      this.call === 1
    ) {
      json = {
        headline: "TOP 10 Martin Scorsese Films",
        sourceGuess: "instagram",
        contentType: "recommendation-list",
        recommendationType: "ranked-list",
        isRanked: true,
        isCarousel: false,
        hasRecommendations: true,
        hasMoviePoster: false,
        hasTitleLikeText: true,
        recommendationSignals: ["ranked recommendation list"],
        expectedCount: 10,
        theme: "Martin Scorsese",
        mood: "Gritty",
        context: this.expected.expectedContext,
        recommendationReason: "Essential picks for movie night",
        collectionIdeas: ["Scorsese", "Crime Classics"],
        ignoreHints: [
          "likes",
          "comments",
          "usernames",
          "navigation chrome",
          "sponsored label",
        ],
        confidence: 0.94,
        notes: null,
      };
    } else {
      json = {
        recommendations: this.expected.rankedTitles.map((item) => ({
          title: item.title,
          year: item.year,
          mediaType: "movie",
          rank: item.rank,
          context: this.expected.expectedContext,
          rawVisibleText: `${item.rank}. ${item.title}`,
          alternateTitles: [],
          confidence: 0.96,
        })),
        confidence: 0.93,
        notes: null,
      };
    }

    return {
      text: JSON.stringify(json),
      json,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: "fixture-two-stage",
      provider: this.id,
      latencyMs: 1,
    };
  }
}

describe("Scorsese Instagram regression (two-stage semantic vision)", () => {
  const expected = loadExpected();

  beforeEach(() => {
    setAIServiceForTests(
      new AIService(new FixtureTwoStageProvider(expected)),
    );
  });

  it("extracts the ranked Scorsese list — not unrelated movies", async () => {
    // Stub TMDb so the eval focuses on extraction semantics.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.themoviedb.org")) {
        const query = new URL(url).searchParams.get("query") ?? "";
        const hit = expected.rankedTitles.find((item) =>
          normalizeTitle(query).includes(normalizeTitle(item.title)),
        );
        return new Response(
          JSON.stringify({
            results: hit
              ? [
                  {
                    id: hit.rank * 100,
                    title: hit.title,
                    poster_path: null,
                    release_date: `${hit.year}-01-01`,
                    overview: "",
                    vote_average: 8,
                    genre_ids: [80],
                  },
                ]
              : [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return originalFetch(input);
    }) as typeof fetch;

    try {
      // Ensure TMDB key presence for service guard (value unused due to stub).
      process.env.TMDB_API_KEY ??= "test-tmdb-key";

      const result = await analyzeCapture({
        imageDataUrl: imageDataUrl(),
        existingCollectionNames: ["Date Night", "Sci-Fi"],
      });

      const titles = result.vision.recommendations.map((r) => r.title);
      const ranks = result.vision.recommendations.map((r) => r.rank);

      expect(result.vision.understanding?.context).toMatch(/scorsese/i);
      expect(result.vision.understanding?.isRanked).toBe(true);
      expect(result.source.type).toBe("instagram");
      expect(titles).toHaveLength(expected.expectedCount);
      expect(titles).toEqual(expected.rankedTitles.map((r) => r.title));
      expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(
        result.vision.recommendations.every(
          (r) => typeof r.confidence === "number" && r.confidence > 0.5,
        ),
      ).toBe(true);
      expect(
        result.vision.recommendations.every((r) =>
          (r.context ?? "").toLowerCase().includes("scorsese"),
        ),
      ).toBe(true);

      for (const forbidden of expected.forbiddenTitles) {
        expect(
          titles.some(
            (title) =>
              normalizeTitle(title) === normalizeTitle(forbidden) ||
              normalizeTitle(title).includes(normalizeTitle(forbidden)),
          ),
        ).toBe(false);
      }

      // Matched movies should also be Scorsese titles, not random popular films.
      const matchedTitles = result.matches
        .map((m) => m.movie?.title)
        .filter(Boolean);
      expect(matchedTitles.length).toBeGreaterThan(0);
      for (const title of matchedTitles) {
        expect(
          expected.rankedTitles.some(
            (item) =>
              normalizeTitle(item.title) === normalizeTitle(title as string),
          ),
        ).toBe(true);
      }
    } finally {
      globalThis.fetch = originalFetch;
      setAIServiceForTests(null);
    }
  });
});

const RUN_LIVE =
  process.env.CAPTURE_LIVE_EVAL === "1" &&
  Boolean(process.env.OPENAI_API_KEY?.trim());

describe.runIf(RUN_LIVE)(
  "Scorsese Instagram live vision eval (opt-in)",
  () => {
    const expected = loadExpected();

    beforeEach(() => {
      setAIServiceForTests(null);
    });

    it("live model returns Scorsese ranked titles from fixture screenshot", async () => {
      process.env.TMDB_API_KEY ??= "test-tmdb-key";
      const result = await analyzeCapture({
        imageDataUrl: imageDataUrl(),
      });

      const extracted = result.vision.recommendations.map((r) =>
        normalizeTitle(r.title),
      );
      const expectedNorm = expected.rankedTitles.map((r) =>
        normalizeTitle(r.title),
      );

      // Allow minor variance: at least 8/10 correct titles + Scorsese framing.
      const hits = expectedNorm.filter((title) => extracted.includes(title));
      const framing = [
        result.vision.understanding?.context,
        result.vision.understanding?.headline,
        result.vision.understanding?.theme,
        result.vision.headline,
        result.vision.theme,
      ]
        .filter(Boolean)
        .join(" ");
      expect(framing).toMatch(/scorsese/i);
      expect(hits.length).toBeGreaterThanOrEqual(8);

      for (const forbidden of expected.forbiddenTitles) {
        expect(extracted).not.toContain(normalizeTitle(forbidden));
      }
    }, 120_000);
  },
);
