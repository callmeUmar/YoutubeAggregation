# Proposed frontend ↔ backend contract (draft)

**Status: proposal, not agreed.** The backend is still in development. Nothing
here describes an implemented endpoint. The TypeScript source of truth for these
shapes is [`src/api/types.ts`](../src/api/types.ts); change both together.

The frontend reaches data only through the `AnalysisService` interface
([`src/api/service.ts`](../src/api/service.ts)). Phase 1 ships a deterministic
mock (`src/mock/`). An HTTP implementation can replace it in
`src/api/index.ts` without touching any component.

Conventions assumed from the backend README: JSON is camelCase, timestamps are
UTC ISO 8601, YouTube IDs are primary keys, and the quota day resets at midnight
`America/Los_Angeles`.

---

## 1. Start (or reuse) an analysis: `POST /analyses`

Request:

```json
{
  "channel": "@creatorlab",
  "periodA": { "start": "2026-05-16", "end": "2026-08-13" },
  "periodB": { "start": "2026-08-14", "end": "2026-11-11" },
  "groupBy": "videoPublishedAt"
}
```

- `channel` is already normalized by the frontend: a lowercase `@handle` or a
  case-preserved `UC…` channel ID. The frontend also accepts youtube.com links
  but converts them before sending.
- Dates are **inclusive** calendar dates (`YYYY-MM-DD`).
- The frontend guarantees `start <= end`, no future dates, no overlap between
  periods, and at most 366 days per period.

Proposed response: `202 Accepted` (or `200` on a cache hit), as an `AnalysisJob`:

```json
{ "key": "a1b2c3…", "status": "queued", "progress": 0, "step": "Queued", "error": null, "result": null }
```

## 2. Poll: `GET /analyses/{key}`

Returns the same `AnalysisJob` shape. `status` is one of
`queued | running | done | error` (matching the `analyses` table). When
`status` is `done`, `result` is an `AnalysisResult`:

```jsonc
{
  "key": "a1b2c3…",
  "source": "youtube",                 // frontend shows a DEMO banner for anything else
  "channel": { "id": "UC…", "handle": "@creatorlab", "title": "Creator Lab", "url": "https://www.youtube.com/@creatorlab" },
  "groupBy": "videoPublishedAt",
  "generatedAt": "2026-11-11T18:00:00Z",
  "granularity": "week",               // "week" | "month" (30-day blocks)
  "periods": {
    "A": {
      "period": "A",
      "range": { "start": "2026-05-16", "end": "2026-08-13" },
      "videoCount": 37,                // videos whose comments were analyzed
      "videosSkipped": 3,              // e.g. comments disabled
      "commentCount": 3122,            // == praise + neutral + criticism
      "sentiment": { "praise": 1737, "neutral": 732, "criticism": 653 }
    },
    "B": { "…": "same shape" }
  },
  "trend": [
    {
      "period": "A", "index": 0,       // 0-based position within its period
      "start": "2026-05-16", "end": "2026-05-22",
      "videoCount": 3, "commentCount": 241,
      "sentiment": { "praise": 150, "neutral": 52, "criticism": 39 }
    }
  ],
  "keywords": {
    "A": [ { "term": "audio", "count": 175, "sentiment": { "praise": 90, "neutral": 40, "criticism": 45 } } ],
    "B": [ "…" ]
  }
}
```

Design choices behind this shape:

- **Counts, not percentages.** The frontend computes every percentage, so each
  number on screen traces back to a count of comments.
- **Trend buckets carry `index`**, so the frontend can overlay "week 3 of A"
  and "week 3 of B" even when the periods are months apart.
- **Keywords carry per-sentiment counts**, which the keyword bars show as a
  sentiment mix.

## 3. Evidence: `GET /analyses/{key}/comments`

Query parameters (all optional, all narrowing):

| Param | Example | Meaning |
|---|---|---|
| `period` | `A` | Only comments in that period |
| `sentiment` | `criticism` | Only that label |
| `keyword` | `audio` | Case-insensitive whole-word match, same rule used to count keywords |
| `videoPublishedFrom` / `videoPublishedTo` | `2026-06-06` | Trend bucket: comments on videos published in this inclusive range |
| `cursor` | opaque | From the previous page's `nextCursor` |
| `limit` | `20` | Page size (mock: default 20, max 100) |

Response:

```jsonc
{
  "items": [
    {
      "id": "Ugx…",
      "text": "The audio keeps cutting out around the middle.",   // plain text (see Q9)
      "authorName": "@someone",
      "likeCount": 12,
      "publishedAt": "2026-06-08T14:02:11Z",
      "sentiment": "criticism",
      "period": "A",
      "isReply": false,
      "video": { "id": "<11-char video id>", "title": "…", "publishedAt": "2026-06-07T16:00:00Z", "url": "https://www.youtube.com/watch?v=<id>" },
      "url": "https://www.youtube.com/watch?v=…&lc=Ugx…"
    }
  ],
  "total": 175,          // matches across all pages; must equal the count shown on the dashboard
  "nextCursor": "…"      // null on the last page
}
```

Sort order in the mock: most liked first, then newest, then `id`.

## 4. Errors

Proposed body for any non-2xx response, and for `status: "error"` jobs:

```json
{ "error": { "code": "QUOTA_EXHAUSTED", "message": "…", "retryAt": "2026-11-12T08:00:00Z" } }
```

| `code` | Suggested HTTP | UI behaviour |
|---|---|---|
| `INVALID_CHANNEL` | 404 | "We couldn't find that channel", focus the channel field |
| `COMMENTS_UNAVAILABLE` | 200 job with `status: error`, or 422 | "No comments to analyze", suggest wider dates |
| `QUOTA_EXHAUSTED` | 429 | "Daily YouTube quota reached", shows reset time from `retryAt` |
| *(any other)* | 5xx | Generic "Something went wrong" + retry |

`NETWORK` is client-side only: the frontend uses it when `fetch` itself fails.

## 5. Open questions for Umar (API) and Muhammad (sentiment analysis)

1. **Async vs sync.** Is `POST /analyses` + polling `GET /analyses/{key}` the plan,
   or does `POST` block until done? What poll interval is acceptable?
2. **Result schema.** Can `result_json` adopt the `AnalysisResult` shape above,
   or what should change? Who computes trend buckets: the API or `analyze()`?
3. **Channel resolution.** Does the backend accept `@handle` and `UC…` IDs as
   sent? Should it also accept full URLs? What does `handle` look like in
   responses (with or without `@`)? The DB stores it lowercase without `@`.
4. **Date semantics.** Are period boundaries interpreted in UTC, Pacific time,
   or the viewer's time zone? (The frontend sends plain dates, and the mock treats
   them as UTC.)
5. **Bucket granularity.** The mock uses weeks when both periods are ≤120 days,
   otherwise 30-day blocks. Is that acceptable, or should calendar months be used?
6. **Keyword definition (Muhammad).** Tokenization, stop words, bigrams? Is `count` the
   number of comments mentioning the term (the mock's choice) or total occurrences?
   Top-N per period (the mock uses 10)? Can per-keyword sentiment counts be provided?
7. **Replies.** Are replies (`parent_id` set) analyzed and counted? The UI can show
   a "Reply" tag either way.
8. **Sampling.** If quota forces a cap on comments per video, the response needs a
   flag (e.g. `sampled: true`, `commentsAvailable`) so the UI never implies full coverage.
9. **Comment text.** Please return plain text (YouTube `textOriginal`), not
   `textDisplay` HTML. The UI renders text only, never HTML.
10. **Quota soft limit.** Above `QUOTA_SOFT_LIMIT` the backend serves cached data
    only. How is that signalled: an error, or a result with a `stale`/`cachedAt` field?
11. **Error codes.** Are the codes in §4 acceptable? Any others (e.g. `CHANNEL_TOO_LARGE`)?
12. **Base URL & CORS.** The frontend will read `VITE_API_BASE_URL`. The backend's
    default `CORS_ORIGINS` already includes `http://localhost:5173`, which the dev
    server uses.
