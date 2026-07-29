import { matchRecommendations } from "@/lib/capture/intelligence/tmdb-matcher";
import type { VisionRecommendation } from "@/lib/capture/intelligence/types";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string;
      year?: number | null;
      alternateTitles?: string[];
    };
    const title = body.title?.trim();
    if (!title) {
      return Response.json({ error: "Title is required." }, { status: 400 });
    }

    const extracted: VisionRecommendation = {
      title,
      year: body.year ?? null,
      mediaType: "movie",
      alternateTitles: body.alternateTitles ?? [],
      confidence: 0.7,
    };
    const [match] = await matchRecommendations([extracted]);
    return Response.json({ match });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Rematch failed.";
    logger.error("Capture rematch failed", { message });
    return Response.json({ error: message }, { status: 500 });
  }
}
