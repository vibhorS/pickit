import { AIError } from "@/lib/ai/errors";
import type {
  AICompletionRequest,
  AICompletionResult,
  AIProvider,
  AIRequestOptions,
} from "@/lib/ai/types";

/**
 * Used when no API key is configured.
 * isConfigured() is false; complete() fails gracefully with NOT_CONFIGURED.
 */
export class StubAIProvider implements AIProvider {
  readonly id = "stub" as const;

  isConfigured(): boolean {
    return false;
  }

  async complete(
    _request: AICompletionRequest,
    _options?: AIRequestOptions,
  ): Promise<AICompletionResult> {
    void _request;
    void _options;
    throw new AIError(
      "NOT_CONFIGURED",
      "AI is not configured. Add OPENAI_API_KEY to .env.local (server-only).",
      { retryable: false },
    );
  }
}
