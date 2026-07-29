/**
 * Provider-agnostic AI types.
 * Application code depends on these — never on OpenAI/Gemini/Claude SDKs.
 */

export type AIProviderId = "openai" | "gemini" | "claude" | "stub";

export type AIMessageRole = "system" | "user" | "assistant";

export type AIMessage = {
  role: AIMessageRole;
  content: string;
};

export type AIJsonSchema = {
  /** Schema name sent to providers that require one (e.g. OpenAI). */
  name: string;
  /** JSON Schema object describing the expected response. */
  schema: Record<string, unknown>;
  /** Prefer strict schema adherence when the provider supports it. */
  strict?: boolean;
};

export type AICompletionRequest = {
  messages: AIMessage[];
  /** Provider-specific model id. Defaults are chosen per provider. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /**
   * `json` asks the provider for a JSON object response.
   * Prefer `jsonSchema` when you need a validated shape.
   */
  responseFormat?: "text" | "json";
  jsonSchema?: AIJsonSchema;
};

export type AITokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type AICompletionResult = {
  text: string;
  /** Present when responseFormat is json or jsonSchema was provided. */
  json?: unknown;
  usage: AITokenUsage;
  model: string;
  provider: AIProviderId;
  latencyMs: number;
  requestId?: string;
};

export type AIRequestOptions = {
  /** Abort after this many ms. */
  timeoutMs?: number;
  /** Override default retry attempts. */
  retries?: number;
  /** Correlation id for logs. */
  requestId?: string;
  signal?: AbortSignal;
};

/**
 * Swap OpenAI → Gemini/Claude by implementing this interface
 * and registering it in the factory. Application code stays unchanged.
 */
export interface AIProvider {
  readonly id: AIProviderId;
  isConfigured(): boolean;
  complete(
    request: AICompletionRequest,
    options?: AIRequestOptions,
  ): Promise<AICompletionResult>;
}

export type AIUsageEvent = {
  provider: AIProviderId;
  model: string;
  usage: AITokenUsage;
  latencyMs: number;
  requestId?: string;
  operation: string;
  ok: boolean;
  errorCode?: string;
  at: string;
};
