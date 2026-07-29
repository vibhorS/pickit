import { afterEach, describe, expect, it } from "vitest";
import { matchRecommendations } from "@/lib/capture/intelligence/tmdb-matcher";

describe("tmdb matcher confidence-based selection", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("auto-selects when one candidate is clearly dominant", async () => {
    process.env.TMDB_API_KEY ??= "test-key";
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              id: 1368337,
              title: "The Odyssey",
              poster_path: null,
              release_date: "2026-01-01",
              overview: "",
              vote_average: 8.1,
              genre_ids: [12],
            },
            {
              id: 824196,
              title: "The Odyssey",
              poster_path: null,
              release_date: "2021-01-01",
              overview: "",
              vote_average: 0.0,
              genre_ids: [],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;

    const [match] = await matchRecommendations([
      {
        title: "The Odyssey",
        year: 2026,
        rank: 1,
        confidence: 0.95,
        rawVisibleText: "The Odyssey",
      },
    ]);

    expect(match?.matchDecision).toBe("auto-selected");
    expect(match?.selected).toBe(true);
    expect(match?.matchStatus).toBe("matched");
  });

  it("requires manual review when alternatives are similarly plausible", async () => {
    process.env.TMDB_API_KEY ??= "test-key";
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              id: 1,
              title: "Crash",
              poster_path: null,
              release_date: "2004-01-01",
              overview: "",
              vote_average: 7.7,
              genre_ids: [18],
            },
            {
              id: 2,
              title: "Crash",
              poster_path: null,
              release_date: "1996-01-01",
              overview: "",
              vote_average: 7.6,
              genre_ids: [18],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;

    const [match] = await matchRecommendations([
      {
        title: "Crash",
        year: null,
        rank: 1,
        confidence: 0.9,
        rawVisibleText: "Crash",
      },
    ]);

    expect(match?.matchDecision).toBe("manual-review");
    expect(match?.selected).toBe(false);
    expect(match?.matchStatus).toBe("ambiguous");
  });
});
