# Scorsese Instagram Capture Fixture

Regression fixture for Capture Intelligence two-stage vision.

- `screenshot.png` — Instagram-style "Top 10 Martin Scorsese Films" post
  (includes likes/comments/nav chrome that must be ignored)
- `expected.json` — golden ranked titles + forbidden unrelated movies

## Offline regression

```bash
npm test
```

## Live model eval (requires API key)

```bash
CAPTURE_LIVE_EVAL=1 npm test -- scorsese-regression
```

Replace `screenshot.png` with a real Instagram capture anytime — keep
`expected.json` aligned to that post's ranked list.
