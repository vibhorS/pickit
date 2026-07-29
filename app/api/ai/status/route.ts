import { getAIService } from "@/lib/ai/ai-service";

/**
 * Lightweight AI readiness probe for ops / settings.
 * Does not call the model — only reports configuration.
 */
export async function GET() {
  const status = getAIService().status();
  return Response.json(status, {
    status: status.configured ? 200 : 503,
  });
}
