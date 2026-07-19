import { detectCaptureSource } from "@/lib/capture/source-detector";
import type {
  CaptureAdapter,
  CaptureExtractionProvider,
  CapturePayload,
  CapturePersistence,
  CaptureResult,
  CaptureSaveResult,
  CaptureSession,
  MovieCandidate,
} from "@/lib/capture/types";
import type { RecommendationMetadata } from "@/lib/types";

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class CaptureService {
  constructor(
    private readonly extractionProvider: CaptureExtractionProvider,
  ) {}

  receive<TInput>(
    adapter: CaptureAdapter<TInput>,
    input: TInput,
  ): Promise<CapturePayload> {
    return adapter.receive(input);
  }

  detectSource(payload: CapturePayload) {
    return detectCaptureSource(payload);
  }

  extract(payload: CapturePayload): Promise<CaptureResult> {
    const source = this.detectSource(payload);
    return this.extractionProvider.extract(payload, source);
  }

  review(
    payload: CapturePayload,
    result: CaptureResult,
    candidates: MovieCandidate[] = result.candidates,
  ): CaptureSession {
    const reviewedResult = {
      ...result,
      candidates,
      detectedCount: candidates.length,
    };

    return {
      id: createId("session"),
      payload,
      result: reviewedResult,
      status: "review",
      approvedCandidateIds: candidates
        .filter((candidate) => candidate.selected)
        .map((candidate) => candidate.id),
      collectionIds: [],
      importedAt: new Date().toISOString(),
    };
  }

  async save(
    session: CaptureSession,
    candidates: MovieCandidate[],
    collectionIds: string[],
    recommendationMetadata: RecommendationMetadata,
    persistence: CapturePersistence,
  ): Promise<CaptureSaveResult> {
    const approved = candidates.filter((candidate) => candidate.selected);
    if (approved.length === 0) {
      throw new Error("Select at least one movie to save.");
    }
    if (collectionIds.length === 0) {
      throw new Error("Choose at least one collection.");
    }

    return persistence.save({
      session: {
        ...session,
        result: {
          ...session.result,
          candidates,
          detectedCount: candidates.length,
        },
        approvedCandidateIds: approved.map((candidate) => candidate.id),
        collectionIds,
        recommendationMetadata,
      },
      candidates: approved,
      collectionIds,
      recommendationMetadata,
    });
  }

  async capture<TInput>(
    adapter: CaptureAdapter<TInput>,
    input: TInput,
  ): Promise<CaptureSession> {
    const payload = await this.receive(adapter, input);
    const result = await this.extract(payload);
    return this.review(payload, result);
  }
}
