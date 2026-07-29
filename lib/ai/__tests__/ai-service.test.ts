import { describe, expect, it, vi, beforeEach } from "vitest";
import { AIService, createAIService } from "@/lib/ai/ai-service";
import { AIError } from "@/lib/ai/errors";
import { createAIProvider } from "@/lib/ai/factory";
import { OpenAIProvider } from "@/lib/ai/providers/openai-provider";
import { StubAIProvider } from "@/lib/ai/providers/stub-provider";
import {
  clearAIUsageLog,
  getRecentAIUsage,
} from "@/lib/ai/usage";

describe("createAIProvider", () => {
  it("returns stub when API key is missing", () => {
    const provider = createAIProvider({
      provider: "openai",
      openaiApiKey: "",
    });
    expect(provider).toBeInstanceOf(StubAIProvider);
    expect(provider.isConfigured()).toBe(false);
  });

  it("returns OpenAIProvider when key is present", () => {
    const provider = createAIProvider({
      provider: "openai",
      openaiApiKey: "sk-test",
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.isConfigured()).toBe(true);
  });

  it("returns stub for unimplemented providers", () => {
    const provider = createAIProvider({ provider: "gemini" });
    expect(provider).toBeInstanceOf(StubAIProvider);
  });
});

describe("StubAIProvider / AIService", () => {
  beforeEach(() => {
    clearAIUsageLog();
  });

  it("fails gracefully when not configured", async () => {
    const service = createAIService(new StubAIProvider());
    expect(service.status().configured).toBe(false);
    await expect(
      service.complete({
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    expect(getRecentAIUsage(1)[0]?.ok).toBe(false);
  });
});

describe("OpenAIProvider", () => {
  it("maps chat completions + usage", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: "chatcmpl-1",
          model: "gpt-4o-mini",
          choices: [{ message: { content: '{"titles":["Dune"]}' } }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const provider = new OpenAIProvider({
      apiKey: "sk-test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await provider.complete({
      messages: [{ role: "user", content: "extract" }],
      responseFormat: "json",
    });

    expect(result.json).toEqual({ titles: ["Dune"] });
    expect(result.usage.totalTokens).toBe(15);
    expect(result.provider).toBe("openai");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("maps 429 to RATE_LIMITED", async () => {
    const provider = new OpenAIProvider({
      apiKey: "sk-test",
      fetchImpl: (async () =>
        new Response("rate limit", { status: 429 })) as unknown as typeof fetch,
    });

    await expect(
      provider.complete({
        messages: [{ role: "user", content: "x" }],
      }),
    ).rejects.toBeInstanceOf(AIError);

    try {
      await provider.complete({
        messages: [{ role: "user", content: "x" }],
      });
    } catch (error) {
      expect((error as AIError).code).toBe("RATE_LIMITED");
      expect((error as AIError).retryable).toBe(true);
    }
  });
});

describe("AIService.completeJson", () => {
  beforeEach(() => clearAIUsageLog());

  it("returns typed JSON and records usage", async () => {
    const provider = new OpenAIProvider({
      apiKey: "sk-test",
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            model: "gpt-4o-mini",
            choices: [{ message: { content: '{"count":2}' } }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
          { status: 200 },
        )) as unknown as typeof fetch,
    });

    const service = new AIService(provider);
    const { data, result } = await service.completeJson<{ count: number }>({
      messages: [{ role: "user", content: "count" }],
    });

    expect(data.count).toBe(2);
    expect(result.usage.totalTokens).toBe(2);
    expect(getRecentAIUsage(1)[0]?.ok).toBe(true);
  });
});
