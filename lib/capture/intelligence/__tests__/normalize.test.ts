import { describe, expect, it } from "vitest";
import { normalizeVisionExtraction } from "@/lib/capture/intelligence/normalize";
import { suggestCollections } from "@/lib/capture/intelligence/tmdb-matcher";

describe("normalizeVisionExtraction", () => {
  it("normalizes recommendations and clamps confidence", () => {
    const vision = normalizeVisionExtraction({
      headline: "  Mind-benders  ",
      theme: "Sci-Fi",
      mood: "Intense",
      recommendationReason: "Because twisty",
      sourceGuess: "instagram",
      collectionIdeas: ["Sci-Fi", "Mind-Bending"],
      recommendations: [
        {
          title: "Inception",
          year: 2010,
          mediaType: "movie",
          rank: 1,
          context: "Dreams",
          alternateTitles: [],
          confidence: 1.4,
        },
        { title: "   ", confidence: 0.9 },
      ],
      confidence: -1,
      notes: null,
    });

    expect(vision.headline).toBe("Mind-benders");
    expect(vision.sourceGuess).toBe("instagram");
    expect(vision.recommendations).toHaveLength(1);
    expect(vision.recommendations[0]?.title).toBe("Inception");
    expect(vision.recommendations[0]?.confidence).toBe(1);
    expect(vision.confidence).toBe(0);
  });
});

describe("suggestCollections", () => {
  it("prefers existing collection names when case differs", () => {
    const names = suggestCollections("sci-fi", ["Mind-Bending"], [
      "Sci-Fi",
      "Date Night",
    ]);
    expect(names[0]).toBe("Sci-Fi");
    expect(names).toContain("Mind-Bending");
  });
});
