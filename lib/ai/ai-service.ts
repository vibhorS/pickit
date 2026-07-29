import { AIError, isAIError } from "@/lib/ai/errors";
import { createAIProvider } from "@/lib/ai/factory";
import { parseJsonFromText } from "@/lib/ai/json";
import { withRetryTimeout } from "@/lib/ai/retry";
import type {
  AICompletionRequest,
  AICompletionResult,
  AIJsonSchema,
  AIProvider,
  AIRequestOptions,
} from "@/lib/ai/types";
import { recordAIUsage } from "@/lib/ai/usage";

export type AIServiceStatus = {
  configured: boolean;
  provider: AIProvider["id"];
  message: string;
  /** Present when not configured — helps diagnose missing server env. */
  missingEnv?: string[];
};

/**
 * Server-side AI facade.
 * Route handlers and server actions call this — never React components → OpenAI.
 */
export class AIService {
  constructor(private readonly provider: AIProvider) {}

  getProviderId(): AIProvider["id"] {
    return this.provider.id;
  }

  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  status(): AIServiceStatus {
    if (!this.provider.isConfigured()) {
      const missingEnv = !process.env.OPENAI_API_KEY?.trim()
        ? ["OPENAI_API_KEY"]
        : [];
      return {
        configured: false,
        provider: this.provider.id,
        message:
          "AI is not configured. Set OPENAI_API_KEY in .env.local (server-only), then restart `next dev`.",
        missingEnv,
      };
    }
    return {
      configured: true,
      provider: this.provider.id,
      message: `AI ready (${this.provider.id})`,
    };
  }

  async complete(
    request: AICompletionRequest,
    options: AIRequestOptions = {},
  ): Promise<AICompletionResult> {
    const operation = "complete";
    const started = Date.now();
    const requestId = options.requestId ?? crypto.randomUUID();

    if (!this.provider.isConfigured()) {
      const error = new AIError(
        "NOT_CONFIGURED",
        "AI is not configured. Add OPENAI_API_KEY to .env.local.",
        { retryable: false },
      );
      recordAIUsage({
        provider: this.provider.id,
        model: request.model ?? "unknown",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: Date.now() - started,
        requestId,
        operation,
        ok: false,
        errorCode: error.code,
        at: new Date().toISOString(),
      });
      throw error;
    }

    try {
      const result = await withRetryTimeout(
        (signal) =>
          this.provider.complete(request, {
            ...options,
            requestId,
            signal: options.signal ?? signal,
          }),
        {
          timeoutMs: options.timeoutMs ?? 30_000,
          retries: options.retries ?? 2,
          signal: options.signal,
        },
      );

      recordAIUsage({
        provider: result.provider,
        model: result.model,
        usage: result.usage,
        latencyMs: result.latencyMs,
        requestId: result.requestId ?? requestId,
        operation,
        ok: true,
        at: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      const aiError = isAIError(error)
        ? error
        : new AIError(
            "UNKNOWN",
            error instanceof Error ? error.message : "AI request failed",
            { retryable: false, cause: error },
          );

      recordAIUsage({
        provider: this.provider.id,
        model: request.model ?? "unknown",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: Date.now() - started,
        requestId,
        operation,
        ok: false,
        errorCode: aiError.code,
        at: new Date().toISOString(),
      });

      throw aiError;
    }
  }

  /**
   * Structured JSON completion. Prefer jsonSchema when the provider supports it.
   */
  async completeJson<T>(
    input: {
      messages: AICompletionRequest["messages"];
      model?: string;
      temperature?: number;
      maxTokens?: number;
      jsonSchema?: AIJsonSchema;
    },
    options?: AIRequestOptions,
  ): Promise<{ data: T; result: AICompletionResult }> {
    const result = await this.complete(
      {
        messages: input.messages,
        model: input.model,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        responseFormat: "json",
        jsonSchema: input.jsonSchema,
      },
      options,
    );

    const data =
      result.json !== undefined
        ? (result.json as T)
        : parseJsonFromText<T>(result.text);

    return { data, result };
  }
}

let singleton: AIService | null = null;

/** Process-wide server singleton (lazy). */
export function getAIService(): AIService {
  if (!singleton) {
    singleton = new AIService(createAIProvider());
    return singleton;
  }

  // If the first boot happened before OPENAI_API_KEY was available (or was
  // empty), recreate once the env provides a real key — without restarting
  // the whole architecture (provider swap stays inside the factory).
  if (!singleton.isConfigured()) {
    const nextProvider = createAIProvider();
    if (nextProvider.isConfigured()) {
      singleton = new AIService(nextProvider);
    }
  }

  return singleton;
}

/** Test helper — reset singleton / inject a custom service. */
export function setAIServiceForTests(service: AIService | null): void {
  singleton = service;
}

export function createAIService(provider?: AIProvider): AIService {
  return new AIService(provider ?? createAIProvider());
}
