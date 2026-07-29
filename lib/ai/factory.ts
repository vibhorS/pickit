import { StubAIProvider } from "@/lib/ai/providers/stub-provider";
import { OpenAIProvider } from "@/lib/ai/providers/openai-provider";
import type { AIProvider, AIProviderId } from "@/lib/ai/types";

export type AIFactoryOptions = {
  /** openai | gemini | claude — only openai is implemented today. */
  provider?: AIProviderId | string | null;
  openaiApiKey?: string | null;
  openaiModel?: string | null;
  fetchImpl?: typeof fetch;
};

function readProviderId(value: string | null | undefined): AIProviderId {
  const normalized = (value ?? "openai").trim().toLowerCase();
  if (normalized === "gemini" || normalized === "claude" || normalized === "stub") {
    return normalized;
  }
  return "openai";
}

/**
 * Build the active AI provider from environment / explicit options.
 * Missing keys yield a StubAIProvider (graceful degradation).
 */
export function createAIProvider(options: AIFactoryOptions = {}): AIProvider {
  const providerId = readProviderId(
    options.provider ?? process.env.AI_PROVIDER,
  );

  if (providerId === "stub") {
    return new StubAIProvider();
  }

  if (providerId === "gemini" || providerId === "claude") {
    // Reserved for future providers — fail soft so app code keeps working.
    return new StubAIProvider();
  }

  const apiKey =
    options.openaiApiKey ?? process.env.OPENAI_API_KEY?.trim() ?? "";

  if (!apiKey) {
    return new StubAIProvider();
  }

  return new OpenAIProvider({
    apiKey,
    defaultModel: options.openaiModel ?? process.env.OPENAI_MODEL ?? undefined,
    fetchImpl: options.fetchImpl,
  });
}
