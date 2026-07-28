import type { Movie, RecommendationMetadata } from "@/lib/types";

export type CaptureSourceType =
  | "instagram"
  | "reddit"
  | "youtube"
  | "letterboxd"
  | "imdb"
  | "netflix"
  | "tiktok"
  | "twitter"
  | "generic-url"
  | "plain-text";

export interface CaptureSource {
  type: CaptureSourceType;
  label: string;
  hostname?: string;
  url?: string;
}

export type CaptureInputKind = "link" | "text" | "movie-list";

export interface CapturePayload {
  id: string;
  adapterId: string;
  kind: CaptureInputKind;
  content: string;
  receivedAt: string;
}

export interface MovieCandidate {
  id: string;
  movie: Movie;
  confidence: number;
  selected: boolean;
  matchedText?: string;
  mergedCandidateIds?: string[];
}

export interface CaptureResult {
  id: string;
  payloadId: string;
  source: CaptureSource;
  originalContent: string;
  candidates: MovieCandidate[];
  detectedCount: number;
  confidence: number;
  extractedAt: string;
}

export type CaptureSessionStatus = "review" | "saved";

export interface CaptureSession {
  id: string;
  payload: CapturePayload;
  result: CaptureResult;
  status: CaptureSessionStatus;
  approvedCandidateIds: string[];
  collectionIds: string[];
  importedAt: string;
  savedAt?: string;
  savedByUserId?: string;
  recommendationMetadata?: RecommendationMetadata;
}

export type CaptureSaveRequest = {
  session: CaptureSession;
  candidates: MovieCandidate[];
  collectionIds: string[];
  recommendationMetadata: RecommendationMetadata;
};

export type CaptureSaveResult = {
  session: CaptureSession;
  savedMovieCount: number;
  collectionIds: string[];
};

export type ManualCaptureInput = {
  kind: CaptureInputKind;
  content: string;
};

export interface CaptureAdapter<TInput = unknown> {
  readonly id: string;
  receive(input: TInput): Promise<CapturePayload>;
}

export interface CaptureExtractionProvider {
  readonly id: string;
  extract(
    payload: CapturePayload,
    source: CaptureSource,
  ): Promise<CaptureResult>;
}

export interface CapturePersistence {
  save(request: CaptureSaveRequest): Promise<CaptureSaveResult>;
}
