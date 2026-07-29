/**
 * PickIt AI infrastructure — server-side only.
 *
 * Architecture:
 *   Route handlers / server actions
 *     → AIService (retry, timeout, usage logging)
 *       → AIProvider (OpenAI | future Gemini/Claude | Stub)
 *
 * React components must never import OpenAIProvider or call OpenAI directly.
 * Feature routes should call getAIService() on the server.
 */

export type {
  AICompletionRequest,
  AICompletionResult,
  AIJsonSchema,
  AIMessage,
  AIProvider,
  AIProviderId,
  AIRequestOptions,
  AITokenUsage,
  AIUsageEvent,
} from "@/lib/ai/types";

export { AIError, isAIError } from "@/lib/ai/errors";
export { createAIProvider } from "@/lib/ai/factory";
export {
  AIService,
  createAIService,
  getAIService,
  setAIServiceForTests,
  type AIServiceStatus,
} from "@/lib/ai/ai-service";
export { OpenAIProvider } from "@/lib/ai/providers/openai-provider";
export { StubAIProvider } from "@/lib/ai/providers/stub-provider";
export {
  clearAIUsageLog,
  getRecentAIUsage,
  recordAIUsage,
  setAIUsageSink,
} from "@/lib/ai/usage";
export { parseJsonFromText, extractJsonText } from "@/lib/ai/json";
export { withRetryTimeout } from "@/lib/ai/retry";
