# Capture Benchmark Assets

This folder stores benchmark screenshots for prompt/evaluation iteration.

## Structure

- `instagram/`
- `reddit/`
- `letterboxd/`
- `youtube/`
- `movie-poster/`
- `bad-quality/`
- `foreign-language/`
- `scorsese-instagram/` (existing regression fixture)

Each case folder should contain:

- `screenshot.png`
- `expected.json`

`expected.json` schema:

```json
{
  "id": "case-id",
  "expectedRecommendationCount": 1,
  "rankedTitles": [{ "rank": 1, "title": "The Odyssey", "year": 2026 }],
  "expectedTmdbIds": ["1368337"],
  "expectedConfidence": "high",
  "forbiddenTitles": []
}
```

## Metrics tracked

- AI extraction success %
- Recovery success %
- TMDb match success %
- Auto-selection %
- Manual review %
- Successful import %
- Failure reasons
- Average confidence
- Average processing time

Use `lib/capture/intelligence/benchmark.ts` to evaluate runs consistently.
