import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  mergeVisionStages,
  normalizeExtractionPayload,
  normalizeSceneUnderstanding,
} from "@/lib/capture/intelligence/normalize";

const FIXTURE_DIR = path.resolve(
  process.cwd(),
  "fixtures/capture/scorsese-instagram",
);

type ExpectedFixture = {
  expectedContext: string;
  expectedSource: string;
  expectedRecommendationType: string;
  expectedIsRanked: boolean;
  expectedCount: number;
  rankedTitles: Array<{ rank: number; title: string; year: number }>;
  forbiddenTitles: string[];
};

function loadExpected(): ExpectedFixture {
  return JSON.parse(
    fs.readFileSync(path.join(FIXTURE_DIR, "expected.json"), "utf8"),
  ) as ExpectedFixture;
}

describe("semantic vision normalize (Scorsese fixture)", () => {
  const expected = loadExpected();

  it("normalizes Stage-1 understanding without inventing titles", () => {
    const understanding = normalizeSceneUnderstanding({
      headline: "TOP 10 Martin Scorsese Films",
      sourceGuess: "instagram",
      contentType: "recommendation-list",
      recommendationType: "ranked-list",
      isRanked: true,
      isCarousel: false,
      hasRecommendations: true,
      hasMoviePoster: false,
      hasTitleLikeText: true,
      recommendationSignals: ["ranked list text"],
      expectedCount: 10,
      theme: "Scorsese",
      mood: "Intense",
      context: "Top 10 Martin Scorsese Films",
      recommendationReason: "Essential picks for movie night",
      collectionIdeas: ["Scorsese", "Crime Classics"],
      ignoreHints: ["likes", "comments", "navigation"],
      confidence: 0.92,
      notes: null,
    });

    expect(understanding.context).toMatch(/scorsese/i);
    expect(understanding.sourceGuess).toBe(expected.expectedSource);
    expect(understanding.recommendationType).toBe(
      expected.expectedRecommendationType,
    );
    expect(understanding.isRanked).toBe(true);
    expect(understanding.expectedCount).toBe(10);
  });

  it("merges stages preserving rank order and context", () => {
    const understanding = normalizeSceneUnderstanding({
      headline: "TOP 10 Martin Scorsese Films",
      sourceGuess: "instagram",
      contentType: "recommendation-list",
      recommendationType: "ranked-list",
      isRanked: true,
      isCarousel: false,
      hasRecommendations: true,
      hasMoviePoster: false,
      hasTitleLikeText: true,
      recommendationSignals: ["ranked list text"],
      expectedCount: 10,
      theme: "Martin Scorsese",
      mood: "Gritty",
      context: expected.expectedContext,
      recommendationReason: "Essential picks",
      collectionIdeas: ["Scorsese"],
      ignoreHints: ["likes"],
      confidence: 0.9,
      notes: null,
    });

    const extraction = {
      recommendations: [...expected.rankedTitles]
        .reverse()
        .map((item) => ({
          title: item.title,
          year: item.year,
          mediaType: "movie",
          rank: item.rank,
          context: null,
          rawVisibleText: `${item.rank}. ${item.title}`,
          alternateTitles: [],
          confidence: 0.95,
        })),
      confidence: 0.9,
      notes: null,
    };

    const vision = mergeVisionStages(understanding, extraction);
    expect(vision.recommendations).toHaveLength(10);
    expect(vision.recommendations.map((r) => r.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(vision.recommendations.map((r) => r.title)).toEqual(
      expected.rankedTitles.map((r) => r.title),
    );
    expect(vision.recommendations[0]?.context).toMatch(/scorsese/i);
    expect(vision.understanding?.context).toBe(expected.expectedContext);
  });

  it("drops social UI noise leaked as fake titles", () => {
    const items = normalizeExtractionPayload({
      recommendations: [
        {
          title: "Goodfellas",
          year: 1990,
          mediaType: "movie",
          rank: 1,
          context: null,
          rawVisibleText: "1. Goodfellas",
          alternateTitles: [],
          confidence: 0.9,
        },
        {
          title: "View all 348 comments",
          year: null,
          mediaType: "unknown",
          rank: 2,
          context: null,
          rawVisibleText: "View all 348 comments",
          alternateTitles: [],
          confidence: 0.4,
        },
        {
          title: "12,482 likes",
          year: null,
          mediaType: "unknown",
          rank: 3,
          context: null,
          rawVisibleText: "12,482 likes",
          alternateTitles: [],
          confidence: 0.2,
        },
      ],
    });

    expect(items.map((i) => i.title)).toEqual(["Goodfellas"]);
  });

  it("prefers list-title framing over decorative subtitles", () => {
    const understanding = normalizeSceneUnderstanding({
      headline: "TOP 10 Martin Scorsese Films",
      sourceGuess: "instagram",
      contentType: "recommendation-list",
      recommendationType: "ranked-list",
      isRanked: true,
      isCarousel: false,
      hasRecommendations: true,
      hasMoviePoster: false,
      hasTitleLikeText: true,
      recommendationSignals: [],
      expectedCount: 10,
      theme: "Scorsese",
      mood: null,
      context: "essential picks for movie night",
      recommendationReason: null,
      collectionIdeas: [],
      ignoreHints: [],
      confidence: 0.9,
      notes: null,
    });

    expect(understanding.context).toMatch(/scorsese/i);
    expect(understanding.context).not.toMatch(/essential picks/i);
  });
});
