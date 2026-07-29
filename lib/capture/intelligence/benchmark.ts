import type {
  CaptureReliabilityMetrics,
  MatchedRecommendation,
  VisionRecommendation,
} from "@/lib/capture/intelligence/types";

export type BenchmarkExpectedItem = {
  rank: number;
  title: string;
};

export type BenchmarkExpected = {
  id: string;
  rankedTitles: BenchmarkExpectedItem[];
  forbiddenTitles?: string[];
};

export type BenchmarkMetrics = {
  totalExpected: number;
  extractedCount: number;
  correctMatches: number;
  incorrectMatches: number;
  missedMovies: number;
  hallucinations: number;
  averageConfidence: number;
  averageProcessingTimeMs: number;
};

export type BenchmarkReport = {
  id: string;
  metrics: BenchmarkMetrics;
  matched: string[];
  missed: string[];
  incorrect: string[];
  hallucinated: string[];
};

export type ReliabilityBenchmarkMetrics = {
  runs: number;
  extractionSuccessRate: number;
  tmdbMatchSuccessRate: number;
  autoSelectionRate: number;
  manualReviewRate: number;
  importSuccessRate: number;
  failureReasonCounts: Record<string, number>;
};

export type ReliabilityBenchmarkReport = {
  id: string;
  metrics: ReliabilityBenchmarkMetrics;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function evaluateBenchmarkRun(input: {
  expected: BenchmarkExpected;
  extracted: VisionRecommendation[];
  processingTimesMs: number[];
}): BenchmarkReport {
  const expectedTitles = input.expected.rankedTitles.map((item) => item.title);
  const expectedSet = new Set(expectedTitles.map(normalize));
  const forbiddenSet = new Set((input.expected.forbiddenTitles ?? []).map(normalize));

  const extractedTitles = input.extracted.map((item) => item.title);
  const extractedNorm = extractedTitles.map(normalize);

  const matched = expectedTitles.filter((title) => extractedNorm.includes(normalize(title)));
  const missed = expectedTitles.filter((title) => !extractedNorm.includes(normalize(title)));

  const incorrect = extractedTitles.filter((title) => !expectedSet.has(normalize(title)));
  const hallucinated = extractedTitles.filter((title) => forbiddenSet.has(normalize(title)));

  const totalConfidence = input.extracted.reduce(
    (sum, item) => sum + (Number.isFinite(item.confidence) ? item.confidence : 0),
    0,
  );
  const averageConfidence = input.extracted.length
    ? totalConfidence / input.extracted.length
    : 0;

  const totalMs = input.processingTimesMs.reduce((sum, ms) => sum + Math.max(0, ms), 0);
  const averageProcessingTimeMs = input.processingTimesMs.length
    ? totalMs / input.processingTimesMs.length
    : 0;

  return {
    id: input.expected.id,
    metrics: {
      totalExpected: expectedTitles.length,
      extractedCount: extractedTitles.length,
      correctMatches: matched.length,
      incorrectMatches: incorrect.length,
      missedMovies: missed.length,
      hallucinations: hallucinated.length,
      averageConfidence,
      averageProcessingTimeMs,
    },
    matched,
    missed,
    incorrect,
    hallucinated,
  };
}

export function evaluateReliabilityRun(input: {
  id: string;
  reliability: CaptureReliabilityMetrics;
  matches: MatchedRecommendation[];
}): ReliabilityBenchmarkReport {
  const matched = input.matches.filter((m) => m.movie).length;
  const importReady = input.matches.filter((m) => m.selected && m.movie).length;
  const failureReasonCounts: Record<string, number> = {};
  for (const reason of input.reliability.failureReasons) {
    failureReasonCounts[reason] = (failureReasonCounts[reason] ?? 0) + 1;
  }

  return {
    id: input.id,
    metrics: {
      runs: 1,
      extractionSuccessRate: input.reliability.extractionSuccess ? 1 : 0,
      tmdbMatchSuccessRate:
        input.reliability.extractionCount > 0
          ? matched / input.reliability.extractionCount
          : 0,
      autoSelectionRate:
        input.matches.length > 0
          ? input.matches.filter((m) => m.matchDecision === "auto-selected")
              .length / input.matches.length
          : 0,
      manualReviewRate:
        input.matches.length > 0
          ? input.matches.filter((m) => m.matchDecision === "manual-review")
              .length / input.matches.length
          : 0,
      importSuccessRate:
        input.matches.length > 0 ? importReady / input.matches.length : 0,
      failureReasonCounts,
    },
  };
}

export function aggregateReliabilityReports(
  reports: ReliabilityBenchmarkReport[],
): ReliabilityBenchmarkMetrics {
  if (reports.length === 0) {
    return {
      runs: 0,
      extractionSuccessRate: 0,
      tmdbMatchSuccessRate: 0,
      autoSelectionRate: 0,
      manualReviewRate: 0,
      importSuccessRate: 0,
      failureReasonCounts: {},
    };
  }

  const sums = reports.reduce(
    (acc, report) => {
      acc.extraction += report.metrics.extractionSuccessRate;
      acc.tmdb += report.metrics.tmdbMatchSuccessRate;
      acc.auto += report.metrics.autoSelectionRate;
      acc.manual += report.metrics.manualReviewRate;
      acc.importRate += report.metrics.importSuccessRate;
      for (const [reason, count] of Object.entries(
        report.metrics.failureReasonCounts,
      )) {
        acc.reasons[reason] = (acc.reasons[reason] ?? 0) + count;
      }
      return acc;
    },
    {
      extraction: 0,
      tmdb: 0,
      auto: 0,
      manual: 0,
      importRate: 0,
      reasons: {} as Record<string, number>,
    },
  );

  return {
    runs: reports.length,
    extractionSuccessRate: sums.extraction / reports.length,
    tmdbMatchSuccessRate: sums.tmdb / reports.length,
    autoSelectionRate: sums.auto / reports.length,
    manualReviewRate: sums.manual / reports.length,
    importSuccessRate: sums.importRate / reports.length,
    failureReasonCounts: sums.reasons,
  };
}
