/**
 * Capture Intelligence domain — screenshot → inbox → vision → match → review → import.
 * UI never knows which AI provider runs underneath.
 */

import type { Movie } from "@/lib/types";
import type { CaptureSource, CaptureSourceType } from "@/lib/capture/types";

export type CaptureMediaKind = "screenshot" | "url" | "text";

export type CaptureProcessingStatus =
  | "queued"
  | "reading"
  | "understanding"
  | "matching"
  | "checking-duplicates"
  | "preparing"
  | "ready"
  | "imported"
  | "failed"
  | "archived";

export type CaptureProcessingStage =
  | "reading"
  | "understanding"
  | "matching"
  | "checking-duplicates"
  | "preparing";

export const CAPTURE_PROCESSING_STAGES: CaptureProcessingStage[] = [
  "reading",
  "understanding",
  "matching",
  "checking-duplicates",
  "preparing",
];

export type RecommendationType =
  | "ranked-list"
  | "unranked-list"
  | "single"
  | "collage"
  | "thread"
  | "carousel-list"
  | "caption"
  | "unknown";

export type CaptureContentType =
  | "recommendation-list"
  | "recommendation-thread"
  | "review-card"
  | "discussion-post"
  | "unknown";

/** Stage 1 — semantic understanding of the capture (no title list yet). */
export type SceneUnderstanding = {
  headline: string | null;
  sourceGuess: CaptureSourceType | null;
  contentType: CaptureContentType;
  recommendationType: RecommendationType;
  isRanked: boolean;
  isCarousel: boolean;
  hasRecommendations: boolean;
  hasMoviePoster: boolean;
  hasTitleLikeText: boolean;
  recommendationSignals: string[];
  expectedCount: number | null;
  theme: string | null;
  mood: string | null;
  /** Framing line, e.g. "Top 10 Martin Scorsese Films". */
  context: string | null;
  recommendationReason: string | null;
  collectionIdeas: string[];
  ignoreHints: string[];
  confidence: number;
  notes?: string | null;
};

export type VisionRecommendation = {
  title: string;
  year?: number | null;
  mediaType?: "movie" | "tv" | "unknown";
  rank?: number | null;
  context?: string | null;
  /** Raw snippet as seen in screenshot, before normalization. */
  rawVisibleText?: string | null;
  alternateTitles?: string[];
  confidence: number;
};

export type VisionExtraction = {
  headline: string | null;
  theme: string | null;
  mood: string | null;
  recommendationReason: string | null;
  sourceGuess: CaptureSourceType | null;
  collectionIdeas: string[];
  recommendations: VisionRecommendation[];
  confidence: number;
  notes?: string | null;
  /** Stage-1 understanding retained for future AI features. */
  understanding?: SceneUnderstanding | null;
};

export type MatchedRecommendation = {
  id: string;
  extracted: VisionRecommendation;
  movie: Movie | null;
  matchConfidence: number;
  /** Confidence-based decision for import flow. */
  matchDecision: "auto-selected" | "manual-review" | "not-found";
  decisionReason: string;
  dominanceGap: number;
  candidateCount: number;
  candidateDiagnostics: Array<{
    movieId: string;
    title: string;
    year: number | null;
    score: number;
    query: string;
  }>;
  /** Legacy status kept for UI compatibility. */
  matchStatus: "matched" | "ambiguous" | "unmatched";
  alternatives: Movie[];
  selected: boolean;
  rejected: boolean;
  alreadyInCollectionIds: string[];
};

export type CaptureReliabilityMetrics = {
  extractionSuccess: boolean;
  extractionCount: number;
  recoveryPassUsed: boolean;
  tmdbMatchSuccessRate: number;
  autoSelectionRate: number;
  manualReviewRate: number;
  failureReasons: string[];
};

export type CaptureItem = {
  id: string;
  mediaKind: CaptureMediaKind;
  /** Compressed data URL or remote URL for the screenshot. */
  imageDataUrl?: string | null;
  thumbnailDataUrl?: string | null;
  textContent?: string | null;
  sourceUrl?: string | null;
  source: CaptureSource;
  createdAt: string;
  updatedAt: string;
  status: CaptureProcessingStatus;
  errorMessage?: string | null;
  headline?: string | null;
  theme?: string | null;
  mood?: string | null;
  recommendationReason?: string | null;
  confidence?: number | null;
  detectedCount: number;
  vision?: VisionExtraction | null;
  rawAiOutput?: unknown;
  matches: MatchedRecommendation[];
  suggestedCollectionNames: string[];
  selectedCollectionIds: string[];
  createCollectionNames: string[];
  importedMovieIds: string[];
  importedAt?: string | null;
};

export type AnalyzeCaptureRequest = {
  imageDataUrl?: string;
  text?: string;
  sourceUrl?: string;
  existingCollectionNames?: string[];
};

export type AnalyzeCaptureResponse = {
  vision: VisionExtraction;
  matches: MatchedRecommendation[];
  suggestedCollectionNames: string[];
  rawAiOutput: unknown;
  source: CaptureSource;
  reliability?: CaptureReliabilityMetrics;
};
