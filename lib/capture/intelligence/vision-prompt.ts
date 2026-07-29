/**
 * Semantic Capture Vision — two-stage prompts.
 * Stage 1: understand the recommendation post (not OCR).
 * Stage 2: extract only titles that are actually present.
 */

import type { AIJsonSchema } from "@/lib/ai/types";

const SOURCE_ENUM = [
  "instagram",
  "reddit",
  "youtube",
  "letterboxd",
  "imdb",
  "netflix",
  "tiktok",
  "twitter",
  "generic-url",
  "plain-text",
  null,
] as const;

export const VISION_UNDERSTANDING_SCHEMA: AIJsonSchema = {
  name: "capture_scene_understanding",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      headline: { type: ["string", "null"] },
      sourceGuess: { type: ["string", "null"], enum: [...SOURCE_ENUM] },
      recommendationType: {
        type: "string",
        enum: [
          "ranked-list",
          "unranked-list",
          "single",
          "collage",
          "thread",
          "carousel-list",
          "caption",
          "unknown",
        ],
      },
      contentType: {
        type: "string",
        enum: [
          "recommendation-list",
          "recommendation-thread",
          "review-card",
          "discussion-post",
          "unknown",
        ],
      },
      isRanked: { type: "boolean" },
      isCarousel: { type: "boolean" },
      hasRecommendations: { type: "boolean" },
      hasMoviePoster: { type: "boolean" },
      hasTitleLikeText: { type: "boolean" },
      recommendationSignals: { type: "array", items: { type: "string" } },
      expectedCount: { type: ["integer", "null"] },
      theme: { type: ["string", "null"] },
      mood: { type: ["string", "null"] },
      context: { type: ["string", "null"] },
      recommendationReason: { type: ["string", "null"] },
      collectionIdeas: { type: "array", items: { type: "string" } },
      ignoreHints: { type: "array", items: { type: "string" } },
      confidence: { type: "number" },
      notes: { type: ["string", "null"] },
    },
    required: [
      "headline",
      "sourceGuess",
      "contentType",
      "recommendationType",
      "isRanked",
      "isCarousel",
      "hasRecommendations",
      "hasMoviePoster",
      "hasTitleLikeText",
      "recommendationSignals",
      "expectedCount",
      "theme",
      "mood",
      "context",
      "recommendationReason",
      "collectionIdeas",
      "ignoreHints",
      "confidence",
      "notes",
    ],
  },
};

export const VISION_EXTRACTION_SCHEMA: AIJsonSchema = {
  name: "capture_recommendation_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      recommendations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            year: { type: ["integer", "null"] },
            mediaType: {
              type: "string",
              enum: ["movie", "tv", "unknown"],
            },
            rank: { type: ["integer", "null"] },
            context: { type: ["string", "null"] },
            rawVisibleText: { type: ["string", "null"] },
            alternateTitles: {
              type: "array",
              items: { type: "string" },
            },
            confidence: { type: "number" },
          },
          required: [
            "title",
            "year",
            "mediaType",
            "rank",
            "context",
            "rawVisibleText",
            "alternateTitles",
            "confidence",
          ],
        },
      },
      confidence: { type: "number" },
      notes: { type: ["string", "null"] },
    },
    required: ["recommendations", "confidence", "notes"],
  },
};

/** @deprecated Prefer VISION_EXTRACTION_SCHEMA — kept for older single-pass callers/tests. */
export const VISION_SINGLE_PASS_SCHEMA = VISION_EXTRACTION_SCHEMA;

export const UNDERSTAND_SYSTEM_PROMPT = `You are PickIt's Capture Intelligence — Stage 1: Semantic Understanding.

Your job is to UNDERSTAND a recommendation screenshot as a human would.
You are NOT an OCR engine. Do not dump every readable word.

Focus on meaning:
- What is being recommended?
- What is the framing headline / list title? (e.g. "Top 10 Martin Scorsese Films")
- Put that list title in BOTH "headline" and "context" when present.
  Prefer the primary list title over decorative subtitles
  (e.g. prefer "Top 10 Martin Scorsese Films" over "Essential picks for movie night").
- Is it ranked? How many items are promised?
- Is it a carousel?
- Do recommendations actually exist?
- Source platform (Instagram, Reddit, YouTube, …)
- Theme, mood, why someone saved this

Explicitly IGNORE social media UI chrome:
- Likes, view counts, timestamps
- Comments and commenter usernames
- Profile handles, "Sponsored", follow buttons
- Home / Search / Reels / Profile navigation
- Ads, stickers, reaction emojis, share sheets
- Decorative captions that are not the recommendation framing

Never invent movie titles in this stage.
If recommendations do not exist, set hasRecommendations=false.
Set hasMoviePoster=true when a poster/key-art style card is clearly visible.
Set hasTitleLikeText=true when you can read text that looks like a movie/series title.
Add short recommendationSignals for evidence (e.g. "full-screen movie poster", "single title card").
Return structured JSON only.`;

export const EXTRACT_SYSTEM_PROMPT = `You are PickIt's Capture Intelligence — Stage 2: Recommendation Extraction.

You receive:
1) The original screenshot / text
2) Stage-1 semantic understanding (headline, context, ranking, theme)

Extract ONLY the movie/TV titles that are actually recommended in the capture.

Hard rules:
- NEVER invent titles. If a title is unclear, keep the best visible reading
  with LOW confidence and include rawVisibleText.
- NEVER pull titles from comments, usernames, ads, or UI chrome.
- NEVER substitute "similar" famous movies because the theme suggests them.
- Preserve ranking / list order exactly when Stage-1 says isRanked=true.
- Preserve the recommendation context on each item (e.g. "Top 10 Martin Scorsese Films").
- Prefer the English title shown; put alternate spellings in alternateTitles.
- Return per-item confidence 0..1 (high only when the title is clearly readable).
- Include rawVisibleText exactly as seen for each extracted recommendation item.
- If Stage-1 expectedCount is set, aim for that many ONLY when they are visible — do not pad with guesses.

Return structured JSON only.`;

export const RECOVERY_EXTRACT_SYSTEM_PROMPT = `You are PickIt's Capture Intelligence — Recovery Extraction.

Stage-1 may report hasRecommendations=false, but visual evidence may still show
a single movie recommendation (for example a poster or title card).

Your job:
- Extract up to 3 likely recommendation titles from the screenshot.
- Prefer 1 title when the capture appears to represent a single movie card/poster.
- Use only visible evidence.

Hard rules:
- NEVER invent titles.
- NEVER return UI labels, usernames, likes, comments, or navigation text.
- If text is partial/unclear, keep the closest visible reading with low confidence.
- Include rawVisibleText exactly as seen.

Return structured JSON only.`;

export function buildUnderstandUserPrompt(input: {
  hasImage: boolean;
  text?: string;
  sourceUrl?: string;
}): string {
  const parts = [
    "Stage 1 — Understand this capture semantically.",
    "Describe the screenshot (source, content type, headline, theme, mood, recommendation type, ranked?, carousel?, recommendations exist?).",
    "Do not list movie titles yet.",
    input.hasImage
      ? "A screenshot is attached."
      : "No image — use the text/URL only.",
  ];
  if (input.sourceUrl) parts.push(`Source URL: ${input.sourceUrl}`);
  if (input.text?.trim()) parts.push(`Pasted text:\n${input.text.trim()}`);
  return parts.join("\n\n");
}

export function buildExtractUserPrompt(input: {
  hasImage: boolean;
  text?: string;
  sourceUrl?: string;
  understandingJson: string;
}): string {
  const parts = [
    "Stage 2 — Extract only the recommended titles that appear in this capture.",
    "Use the Stage-1 understanding below as grounding. Do not invent titles.",
    "For each item return: title, year(if visible), rank, confidence, rawVisibleText.",
    `Stage-1 understanding (JSON):\n${input.understandingJson}`,
    input.hasImage
      ? "The same screenshot is attached again for verification."
      : "No image — extract only from the pasted text.",
  ];
  if (input.sourceUrl) parts.push(`Source URL: ${input.sourceUrl}`);
  if (input.text?.trim()) parts.push(`Pasted text:\n${input.text.trim()}`);
  return parts.join("\n\n");
}

export function buildRecoveryExtractUserPrompt(input: {
  hasImage: boolean;
  sourceUrl?: string;
  understandingJson: string;
}): string {
  const parts = [
    "Recovery extraction — look for single-movie recommendation signals.",
    "Stage-1 found weak list evidence, but there may still be a recommendation.",
    "Extract only visible movie/series title candidates (max 3).",
    "For each item return: title, year(if visible), rank, confidence, rawVisibleText.",
    `Stage-1 understanding (JSON):\n${input.understandingJson}`,
    input.hasImage
      ? "The screenshot is attached."
      : "No image is available.",
  ];
  if (input.sourceUrl) parts.push(`Source URL: ${input.sourceUrl}`);
  return parts.join("\n\n");
}

/** Legacy single-pass helpers (tests / fallbacks). */
export const VISION_SYSTEM_PROMPT = EXTRACT_SYSTEM_PROMPT;

export function buildVisionUserPrompt(input: {
  hasImage: boolean;
  text?: string;
  sourceUrl?: string;
}): string {
  return buildExtractUserPrompt({
    ...input,
    understandingJson: "{}",
  });
}
