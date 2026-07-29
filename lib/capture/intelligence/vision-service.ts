import { getAIService, type AIService } from "@/lib/ai/ai-service";
import { AIError } from "@/lib/ai/errors";
import type { AIContentPart } from "@/lib/ai/types";
import {
  mergeVisionStages,
  normalizeSceneUnderstanding,
  sourceFromVision,
} from "@/lib/capture/intelligence/normalize";
import {
  matchRecommendations,
  suggestCollections,
} from "@/lib/capture/intelligence/tmdb-matcher";
import type {
  AnalyzeCaptureRequest,
  AnalyzeCaptureResponse,
  SceneUnderstanding,
} from "@/lib/capture/intelligence/types";
import {
  buildRecoveryExtractUserPrompt,
  EXTRACT_SYSTEM_PROMPT,
  RECOVERY_EXTRACT_SYSTEM_PROMPT,
  UNDERSTAND_SYSTEM_PROMPT,
  VISION_EXTRACTION_SCHEMA,
  VISION_UNDERSTANDING_SCHEMA,
  buildExtractUserPrompt,
  buildUnderstandUserPrompt,
} from "@/lib/capture/intelligence/vision-prompt";
import { logger } from "@/lib/observability/logger";

function visionModel(): string {
  return (
    process.env.AI_VISION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini"
  );
}

function buildImageParts(
  text: string,
  imageDataUrl?: string,
): AIContentPart[] {
  const parts: AIContentPart[] = [{ type: "text", text }];
  if (imageDataUrl?.startsWith("data:image")) {
    parts.push({
      type: "image_url",
      image_url: { url: imageDataUrl, detail: "high" },
    });
  }
  return parts;
}

async function understandCapture(
  ai: AIService,
  input: {
    hasImage: boolean;
    imageDataUrl?: string;
    text?: string;
    sourceUrl?: string;
  },
): Promise<{ understanding: SceneUnderstanding; raw: unknown }> {
  const { data } = await ai.completeJson<unknown>(
    {
      messages: [
        { role: "system", content: UNDERSTAND_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildImageParts(
            buildUnderstandUserPrompt(input),
            input.imageDataUrl,
          ),
        },
      ],
      model: visionModel(),
      temperature: 0.05,
      maxTokens: 1200,
      jsonSchema: VISION_UNDERSTANDING_SCHEMA,
    },
    { timeoutMs: 45_000, retries: 1 },
  );

  return {
    understanding: normalizeSceneUnderstanding(data),
    raw: data,
  };
}

async function extractRecommendations(
  ai: AIService,
  input: {
    hasImage: boolean;
    imageDataUrl?: string;
    text?: string;
    sourceUrl?: string;
    understanding: SceneUnderstanding;
    recoveryMode?: boolean;
  },
): Promise<{ raw: unknown }> {
  const understandingJson = JSON.stringify(
    {
      headline: input.understanding.headline,
      sourceGuess: input.understanding.sourceGuess,
      recommendationType: input.understanding.recommendationType,
      isRanked: input.understanding.isRanked,
      expectedCount: input.understanding.expectedCount,
      theme: input.understanding.theme,
      mood: input.understanding.mood,
      context: input.understanding.context,
      recommendationReason: input.understanding.recommendationReason,
      ignoreHints: input.understanding.ignoreHints,
    },
    null,
    2,
  );

  const { data } = await ai.completeJson<unknown>(
    {
      messages: [
        {
          role: "system",
          content: input.recoveryMode
            ? RECOVERY_EXTRACT_SYSTEM_PROMPT
            : EXTRACT_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildImageParts(
            input.recoveryMode
              ? buildRecoveryExtractUserPrompt({
                  hasImage: input.hasImage,
                  sourceUrl: input.sourceUrl,
                  understandingJson,
                })
              : buildExtractUserPrompt({
                  hasImage: input.hasImage,
                  text: input.text,
                  sourceUrl: input.sourceUrl,
                  understandingJson,
                }),
            input.imageDataUrl,
          ),
        },
      ],
      model: visionModel(),
      temperature: input.recoveryMode ? 0.05 : 0,
      maxTokens: 2500,
      jsonSchema: VISION_EXTRACTION_SCHEMA,
    },
    { timeoutMs: 55_000, retries: 1 },
  );

  return { raw: data };
}

function shouldRunRecoveryPass(understanding: SceneUnderstanding): boolean {
  if (understanding.hasRecommendations) return false;
  if (understanding.hasMoviePoster) return true;
  if (understanding.hasTitleLikeText && understanding.confidence >= 0.55) return true;
  if (
    understanding.contentType === "review-card" &&
    Boolean(understanding.headline) &&
    understanding.confidence >= 0.6
  ) {
    return true;
  }
  return understanding.recommendationSignals.length > 0;
}

/**
 * Server-side Capture Intelligence orchestrator.
 * Two-stage semantic vision — understand, then extract.
 * Uses AIService only — never a concrete provider.
 */
export async function analyzeCapture(
  input: AnalyzeCaptureRequest,
  options?: { ai?: AIService },
): Promise<AnalyzeCaptureResponse> {
  const startedAt = Date.now();
  const ai = options?.ai ?? getAIService();
  if (!ai.isConfigured()) {
    throw new AIError(
      "NOT_CONFIGURED",
      "AI is not configured. Add OPENAI_API_KEY to enable Capture Intelligence.",
      { retryable: false },
    );
  }

  const hasImage = Boolean(input.imageDataUrl?.startsWith("data:image"));
  if (!hasImage) {
    throw new AIError(
      "INVALID_REQUEST",
      "Provide a screenshot image to capture recommendations.",
      { retryable: false },
    );
  }

  const base = {
    hasImage,
    imageDataUrl: input.imageDataUrl,
    text: undefined,
    sourceUrl: undefined,
  };

  const understandingStartedAt = Date.now();
  const { understanding, raw: understandingRaw } = await understandCapture(
    ai,
    base,
  );
  const understandingMs = Date.now() - understandingStartedAt;
  let recoveryPassUsed = false;
  const failureReasons: string[] = [];

  logger.info("Capture stage-1 understanding", {
    headline: understanding.headline,
    context: understanding.context,
    contentType: understanding.contentType,
    type: understanding.recommendationType,
    isRanked: understanding.isRanked,
    isCarousel: understanding.isCarousel,
    hasRecommendations: understanding.hasRecommendations,
    hasMoviePoster: understanding.hasMoviePoster,
    hasTitleLikeText: understanding.hasTitleLikeText,
    expectedCount: understanding.expectedCount,
    sourceGuess: understanding.sourceGuess,
    confidence: understanding.confidence,
  });

  let extractionRaw: unknown | null = null;
  if (!understanding.hasRecommendations && shouldRunRecoveryPass(understanding)) {
    recoveryPassUsed = true;
    logger.info("Capture recovery pass triggered", {
      contentType: understanding.contentType,
      headline: understanding.headline,
      hasMoviePoster: understanding.hasMoviePoster,
      hasTitleLikeText: understanding.hasTitleLikeText,
      recommendationSignals: understanding.recommendationSignals,
    });
    const recoveryStartedAt = Date.now();
    const recovery = await extractRecommendations(ai, {
      ...base,
      understanding,
      recoveryMode: true,
    });
    extractionRaw = recovery.raw;
    const recoveryMs = Date.now() - recoveryStartedAt;
    logger.info("Capture recovery pass completed", { recoveryMs });
  } else if (!understanding.hasRecommendations) {
    failureReasons.push("stage1:no-recommendations");
  }

  if (!understanding.hasRecommendations && !extractionRaw) {
    const vision = mergeVisionStages(understanding, {
      recommendations: [],
      confidence: understanding.confidence,
      notes: "No recommendations detected in screenshot",
    });
    return {
      vision,
      matches: [],
      suggestedCollectionNames: [],
      rawAiOutput: {
        stage: "two-pass-short-circuit",
        understanding: understandingRaw,
        extraction: null,
      },
      source: sourceFromVision(vision, input.sourceUrl),
      reliability: {
        extractionSuccess: false,
        extractionCount: 0,
        recoveryPassUsed,
        tmdbMatchSuccessRate: 0,
        autoSelectionRate: 0,
        manualReviewRate: 0,
        failureReasons,
      },
    };
  }

  if (!extractionRaw) {
    const extractionStartedAt = Date.now();
    const extraction = await extractRecommendations(ai, {
      ...base,
      understanding,
    });
    extractionRaw = extraction.raw;
    const extractionMs = Date.now() - extractionStartedAt;
    logger.info("Capture extraction completed", { extractionMs });
  }

  const vision = mergeVisionStages(understanding, extractionRaw);

  if (vision.recommendations.length === 0) {
    logger.warn("Capture vision returned zero recommendations", {
      confidence: vision.confidence,
      notes: vision.notes,
      context: understanding.context,
    });
    failureReasons.push("stage2:zero-extractions");
  }

  const matchingStartedAt = Date.now();
  const matches = await matchRecommendations(vision.recommendations, {
    contextHint: understanding.context ?? understanding.theme,
  });
  const matchingMs = Date.now() - matchingStartedAt;
  const suggestedCollectionNames = suggestCollections(
    vision.theme,
    vision.collectionIdeas,
    input.existingCollectionNames ?? [],
  );
  const matchedCount = matches.filter((match) => match.movie).length;
  const autoSelectedCount = matches.filter(
    (match) => match.matchDecision === "auto-selected",
  ).length;
  const manualReviewCount = matches.filter(
    (match) => match.matchDecision === "manual-review",
  ).length;
  if (vision.recommendations.length > 0 && matchedCount === 0) {
    failureReasons.push("tmdb:no-usable-candidates");
  }
  if (matches.length > 0 && autoSelectedCount === 0 && manualReviewCount > 0) {
    failureReasons.push("tmdb:manual-review-required");
  }

  return {
    vision,
    matches,
    suggestedCollectionNames,
    rawAiOutput: {
      stage: "two-pass",
      understanding: understandingRaw,
      extraction: extractionRaw,
      recoveryPassUsed,
      trace: {
        timingsMs: {
          understanding: understandingMs,
          matching: matchingMs,
          total: Date.now() - startedAt,
        },
        tmdbCandidates: matches.map((match) => ({
          title: match.extracted.title,
          matchDecision: match.matchDecision,
          matchStatus: match.matchStatus,
          matchConfidence: match.matchConfidence,
          dominanceGap: match.dominanceGap,
          decisionReason: match.decisionReason,
          candidates: match.candidateDiagnostics,
        })),
        failureReasons,
      },
    },
    source: sourceFromVision(vision, input.sourceUrl),
    reliability: {
      extractionSuccess: vision.recommendations.length > 0,
      extractionCount: vision.recommendations.length,
      recoveryPassUsed,
      tmdbMatchSuccessRate:
        vision.recommendations.length > 0
          ? matchedCount / vision.recommendations.length
          : 0,
      autoSelectionRate:
        matches.length > 0 ? autoSelectedCount / matches.length : 0,
      manualReviewRate:
        matches.length > 0 ? manualReviewCount / matches.length : 0,
      failureReasons,
    },
  };
}
