import { describe, expect, it, vi, beforeEach } from "vitest";
import { AIError } from "@/lib/ai/errors";
import { extractJsonText, parseJsonFromText } from "@/lib/ai/json";
import { withRetryTimeout } from "@/lib/ai/retry";

describe("extractJsonText / parseJsonFromText", () => {
  it("parses raw JSON objects", () => {
    expect(parseJsonFromText('{"title":"Dune"}')).toEqual({ title: "Dune" });
  });

  it("strips markdown fences", () => {
    const raw = "```json\n{\"ok\":true}\n```";
    expect(extractJsonText(raw)).toBe('{"ok":true}');
    expect(parseJsonFromText(raw)).toEqual({ ok: true });
  });

  it("finds embedded JSON in prose", () => {
    expect(parseJsonFromText('Here you go: {"a":1} thanks')).toEqual({ a: 1 });
  });

  it("throws INVALID_JSON for empty input", () => {
    expect(() => parseJsonFromText("   ")).toThrow(AIError);
    try {
      parseJsonFromText("no json here");
    } catch (error) {
      expect(error).toBeInstanceOf(AIError);
      expect((error as AIError).code).toBe("INVALID_JSON");
    }
  });
});

describe("withRetryTimeout", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("returns on first success", async () => {
    const result = await withRetryTimeout(async () => 42, {
      retries: 2,
      timeoutMs: 1000,
    });
    expect(result).toBe(42);
  });

  it("retries retryable AIError then succeeds", async () => {
    let attempts = 0;
    const result = await withRetryTimeout(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new AIError("RATE_LIMITED", "slow down", { retryable: true });
        }
        return "ok";
      },
      { retries: 3, timeoutMs: 2000, baseDelayMs: 1 },
    );
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("does not retry non-retryable errors", async () => {
    let attempts = 0;
    await expect(
      withRetryTimeout(
        async () => {
          attempts += 1;
          throw new AIError("NOT_CONFIGURED", "missing key", {
            retryable: false,
          });
        },
        { retries: 3, timeoutMs: 1000, baseDelayMs: 1 },
      ),
    ).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    expect(attempts).toBe(1);
  });

  it("maps abort from timeout to TIMEOUT", async () => {
    await expect(
      withRetryTimeout(
        async (signal) =>
          new Promise((_, reject) => {
            signal.addEventListener("abort", () => {
              reject(new Error("aborted"));
            });
          }),
        { retries: 0, timeoutMs: 20, baseDelayMs: 1 },
      ),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});
