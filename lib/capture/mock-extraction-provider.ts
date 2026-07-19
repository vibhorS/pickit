import { movies } from "@/lib/mock-data";
import type {
  CaptureExtractionProvider,
  CapturePayload,
  CaptureResult,
  CaptureSource,
  MovieCandidate,
} from "@/lib/capture/types";
import type { Movie } from "@/lib/types";

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

function explicitMatches(content: string): Movie[] {
  const normalizedContent = normalize(content);
  return movies.filter((movie) =>
    normalizedContent.includes(normalize(movie.title)),
  );
}

function deterministicFallback(content: string, count: number): Movie[] {
  if (movies.length === 0) return [];

  const start = hash(content) % movies.length;
  const selected: Movie[] = [];
  for (let offset = 0; offset < movies.length && selected.length < count; offset += 1) {
    selected.push(movies[(start + offset * 3) % movies.length]);
  }
  return Array.from(new Map(selected.map((movie) => [movie.id, movie])).values());
}

function candidateFor(
  movie: Movie,
  index: number,
  explicit: boolean,
): MovieCandidate {
  const confidence = explicit
    ? Math.max(0.82, 0.97 - index * 0.03)
    : Math.max(0.58, 0.86 - index * 0.05);

  return {
    id: createId("candidate"),
    movie,
    confidence,
    selected: true,
    matchedText: movie.title,
  };
}

export class MockCaptureExtractionProvider
  implements CaptureExtractionProvider
{
  readonly id = "mock-extraction";

  async extract(
    payload: CapturePayload,
    source: CaptureSource,
  ): Promise<CaptureResult> {
    const matches = explicitMatches(payload.content);
    const targetCount =
      payload.kind === "movie-list"
        ? Math.min(10, Math.max(3, payload.content.split(/\r?\n/).filter(Boolean).length))
        : 6;
    const fallback = deterministicFallback(payload.content, targetCount);
    const combined = Array.from(
      new Map([...matches, ...fallback].map((movie) => [movie.id, movie])).values(),
    ).slice(0, targetCount);
    const candidates = combined.map((movie, index) =>
      candidateFor(movie, index, matches.some((match) => match.id === movie.id)),
    );
    const confidence =
      candidates.length === 0
        ? 0
        : candidates.reduce((total, candidate) => total + candidate.confidence, 0) /
          candidates.length;

    // This provider intentionally performs deterministic mock extraction only.
    // OCR, scrapers, and LLM providers can implement the same interface later.
    await Promise.resolve();

    return {
      id: createId("result"),
      payloadId: payload.id,
      source,
      originalContent: payload.content,
      candidates,
      detectedCount: candidates.length,
      confidence,
      extractedAt: new Date().toISOString(),
    };
  }
}
