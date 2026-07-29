import { AIError } from "@/lib/ai/errors";
import { parseJsonFromText } from "@/lib/ai/json";
import type {
  AICompletionRequest,
  AICompletionResult,
  AIProvider,
  AIRequestOptions,
  AITokenUsage,
} from "@/lib/ai/types";

const DEFAULT_MODEL = "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export type OpenAIProviderOptions = {
  apiKey: string;
  /** Override API base URL (tests / proxies). */
  baseUrl?: string;
  defaultModel?: string;
  fetchImpl?: typeof fetch;
};

type OpenAIChatResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; type?: string; code?: string };
};

function mapUsage(usage: OpenAIChatResponse["usage"]): AITokenUsage {
  return {
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens:
      usage?.total_tokens ??
      (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0),
  };
}

function mapHttpError(status: number, body: string): AIError {
  const lower = body.toLowerCase();
  if (status === 401 || status === 403) {
    return new AIError("PROVIDER_ERROR", "OpenAI rejected the API key.", {
      retryable: false,
      status,
    });
  }
  if (status === 429) {
    return new AIError("RATE_LIMITED", "OpenAI rate limit exceeded.", {
      retryable: true,
      status,
    });
  }
  if (status === 400) {
    return new AIError(
      "INVALID_REQUEST",
      lower.includes("json") ? body.slice(0, 240) : "Invalid OpenAI request.",
      { retryable: false, status },
    );
  }
  if (status >= 500) {
    return new AIError("PROVIDER_ERROR", "OpenAI is temporarily unavailable.", {
      retryable: true,
      status,
    });
  }
  return new AIError("PROVIDER_ERROR", `OpenAI error (${status})`, {
    retryable: status >= 500,
    status,
  });
}

/**
 * OpenAI Chat Completions provider.
 * Uses fetch — no SDK required — so Gemini/Claude providers can mirror this shape.
 */
export class OpenAIProvider implements AIProvider {
  readonly id = "openai" as const;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAIProviderOptions) {
    this.apiKey = options.apiKey.trim();
    this.baseUrl = (options.baseUrl ?? OPENAI_URL).replace(/\/$/, "");
    this.defaultModel = options.defaultModel ?? DEFAULT_MODEL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(
    request: AICompletionRequest,
    options?: AIRequestOptions,
  ): Promise<AICompletionResult> {
    if (!this.isConfigured()) {
      throw new AIError(
        "NOT_CONFIGURED",
        "OPENAI_API_KEY is missing.",
        { retryable: false },
      );
    }

    const started = Date.now();
    const model = request.model ?? this.defaultModel;
    const wantsJson =
      request.responseFormat === "json" || Boolean(request.jsonSchema);

    const body: Record<string, unknown> = {
      model,
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 1200,
    };

    if (request.jsonSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: request.jsonSchema.name,
          schema: request.jsonSchema.schema,
          strict: request.jsonSchema.strict ?? true,
        },
      };
    } else if (wantsJson) {
      body.response_format = { type: "json_object" };
    }

    let response: Response;
    try {
      response = await this.fetchImpl(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: options?.signal,
      });
    } catch (error) {
      if (options?.signal?.aborted) {
        throw new AIError("ABORTED", "OpenAI request aborted", {
          retryable: false,
          cause: error,
        });
      }
      throw new AIError("PROVIDER_ERROR", "Failed to reach OpenAI", {
        retryable: true,
        cause: error,
      });
    }

    const rawText = await response.text();
    if (!response.ok) {
      throw mapHttpError(response.status, rawText);
    }

    let parsed: OpenAIChatResponse;
    try {
      parsed = JSON.parse(rawText) as OpenAIChatResponse;
    } catch (error) {
      throw new AIError("PROVIDER_ERROR", "OpenAI returned invalid JSON", {
        retryable: true,
        cause: error,
      });
    }

    if (parsed.error?.message) {
      throw new AIError("PROVIDER_ERROR", parsed.error.message, {
        retryable: false,
      });
    }

    const text = parsed.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      throw new AIError("PROVIDER_ERROR", "OpenAI returned an empty response", {
        retryable: true,
      });
    }

    let json: unknown;
    if (wantsJson) {
      json = parseJsonFromText(text);
    }

    return {
      text,
      json,
      usage: mapUsage(parsed.usage),
      model: parsed.model ?? model,
      provider: this.id,
      latencyMs: Date.now() - started,
      requestId: options?.requestId ?? parsed.id,
    };
  }
}
