import { analyzeCapture } from "@/lib/capture/intelligence/vision-service";
import { isAIError } from "@/lib/ai/errors";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  imageDataUrl?: string;
  text?: string;
  sourceUrl?: string;
  existingCollectionNames?: string[];
};

function sanitizeDataUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("data:image/")) return undefined;
  // ~4MB base64 ceiling after client compression
  if (value.length > 5_500_000) {
    throw new Error("Screenshot is too large. Try a tighter crop.");
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const imageDataUrl = sanitizeDataUrl(body.imageDataUrl);
    const text =
      typeof body.text === "string" ? body.text.trim().slice(0, 8000) : undefined;
    const sourceUrl =
      typeof body.sourceUrl === "string"
        ? body.sourceUrl.trim().slice(0, 2000)
        : undefined;

    const result = await analyzeCapture({
      imageDataUrl,
      text,
      sourceUrl,
      existingCollectionNames: Array.isArray(body.existingCollectionNames)
        ? body.existingCollectionNames
            .filter((name): name is string => typeof name === "string")
            .slice(0, 40)
        : [],
    });

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Capture analysis failed.";
    logger.error("Capture analyze failed", { message });

    if (isAIError(error)) {
      const status =
        error.code === "NOT_CONFIGURED"
          ? 503
          : error.code === "INVALID_REQUEST"
            ? 400
            : error.code === "RATE_LIMITED"
              ? 429
              : 502;
      return Response.json(
        { error: message, code: error.code },
        { status },
      );
    }

    return Response.json({ error: message }, { status: 500 });
  }
}
