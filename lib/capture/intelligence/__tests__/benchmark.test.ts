import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  aggregateReliabilityReports,
  evaluateBenchmarkRun,
  evaluateReliabilityRun,
} from "@/lib/capture/intelligence/benchmark";
import type { VisionRecommendation } from "@/lib/capture/intelligence/types";

const BENCH_DIR = path.resolve(
  process.cwd(),
  "test-assets/capture-bench/scorsese-instagram",
);

type ExpectedFixture = {
  id: string;
  rankedTitles: Array<{ rank: number; title: string; year: number }>;
  forbiddenTitles: string[];
};

function loadExpected(): ExpectedFixture {
  return JSON.parse(
    fs.readFileSync(path.join(BENCH_DIR, "expected.json"), "utf8"),
  ) as ExpectedFixture;
}

describe("capture benchmark evaluator", () => {
  it("logs correct/incorrect/missed/hallucinations and averages", () => {
    const expected = loadExpected();
    const extracted: VisionRecommendation[] = [
      { title: "Goodfellas", rank: 1, confidence: 0.96, rawVisibleText: "1. Goodfellas" },
      { title: "Taxi Driver", rank: 2, confidence: 0.93, rawVisibleText: "2. Taxi Driver" },
      { title: "Inception", rank: 3, confidence: 0.22, rawVisibleText: "unclear" },
    ];

    const report = evaluateBenchmarkRun({
      expected: {
        id: expected.id,
        rankedTitles: expected.rankedTitles.map((item) => ({
          rank: item.rank,
          title: item.title,
        })),
        forbiddenTitles: expected.forbiddenTitles,
      },
      extracted,
      processingTimesMs: [4200, 3800, 4000],
    });

    expect(report.metrics.correctMatches).toBe(2);
    expect(report.metrics.incorrectMatches).toBe(1);
    expect(report.metrics.hallucinations).toBe(1);
    expect(report.metrics.missedMovies).toBeGreaterThan(0);
    expect(report.metrics.averageConfidence).toBeGreaterThan(0.6);
    expect(report.metrics.averageProcessingTimeMs).toBeCloseTo(4000, -2);
  });

  it("tracks reliability metrics for import success analysis", () => {
    const reliability = evaluateReliabilityRun({
      id: "odyssey-single",
      reliability: {
        extractionSuccess: true,
        extractionCount: 1,
        recoveryPassUsed: true,
        tmdbMatchSuccessRate: 1,
        autoSelectionRate: 1,
        manualReviewRate: 0,
        failureReasons: [],
      },
      matches: [
        {
          id: "m1",
          extracted: { title: "The Odyssey", confidence: 0.95 },
          movie: {
            id: "1368337",
            title: "The Odyssey",
            year: 2026,
            runtime: 0,
            rating: 7.9,
            genres: ["Adventure"],
            overview: "",
            posterUrl: "",
            mediaType: "movie",
          },
          matchConfidence: 0.88,
          matchDecision: "auto-selected",
          decisionReason: "Best candidate is clearly dominant",
          dominanceGap: 0.17,
          candidateCount: 5,
          candidateDiagnostics: [],
          matchStatus: "matched",
          alternatives: [],
          selected: true,
          rejected: false,
          alreadyInCollectionIds: [],
        },
      ],
    });

    expect(reliability.metrics.importSuccessRate).toBe(1);
    expect(reliability.metrics.autoSelectionRate).toBe(1);

    const aggregate = aggregateReliabilityReports([
      reliability,
      {
        id: "ambiguous-title",
        metrics: {
          runs: 1,
          extractionSuccessRate: 1,
          tmdbMatchSuccessRate: 1,
          autoSelectionRate: 0,
          manualReviewRate: 1,
          importSuccessRate: 0,
          failureReasonCounts: { "tmdb:manual-review-required": 1 },
        },
      },
    ]);

    expect(aggregate.runs).toBe(2);
    expect(aggregate.autoSelectionRate).toBe(0.5);
    expect(aggregate.failureReasonCounts["tmdb:manual-review-required"]).toBe(1);
  });
});
