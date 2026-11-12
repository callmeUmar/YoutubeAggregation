# YouTube Channel Comment Analyzer: Frontend

React dashboard where a creator enters a YouTube channel, picks two date ranges,
and compares comment sentiment (praise / neutral / criticism), trends, and top
keywords. Every number links to the comments behind it.

> **Phase 1 runs on DEMO DATA only.** There is no backend integration yet. All
> numbers and comments are generated locally and deterministically, and the UI
> labels them as demo data everywhere they appear. Nothing comes from the
> YouTube API.

Stack: React 19, TypeScript, Vite, Recharts, plain CSS. Tests use Vitest and
Testing Library. No state-management or UI-kit libraries.

## Requirements

- Node.js 20.19+ (developed on Node 24)
- npm 10+

## Install

```bash
cd frontend
npm install
```

## Run

```bash
npm run dev          # http://localhost:5173
```

Port 5173 matches the backend's default `CORS_ORIGINS`.

### Demo channels

Any valid handle produces a deterministic demo analysis. These reserved handles
reproduce each error state (they also appear as chips under the form):

| Channel | Shows |
|---|---|
| `@creatorlab` | A successful analysis |
| `@demo-not-found` | Invalid / unknown channel |
| `@demo-no-comments` | Comments unavailable |
| `@demo-quota` | Daily YouTube quota exhausted |
| `@demo-offline` | Network failure |

## Build

```bash
npm run build        # type-checks, then writes dist/
npm run preview      # serves dist/ at http://localhost:4173
```

The results dashboard (and Recharts) is lazy-loaded, so the first load is about 82 kB
gzipped.

## Test and check

```bash
npm test             # Vitest, single run
npm run test:watch   # watch mode
npm run lint         # ESLint
npm run typecheck    # tsc, no emit
npm run check        # all of the above + build
```

Tests cover:

- `src/lib/validation.test.ts`: channel input parsing (handles, IDs, URLs, bad input) and date-range rules.
- `src/mock/mockAnalysisService.test.ts`: determinism; internal consistency (keyword counts equal evidence totals, trend buckets sum to period totals); pagination; error scenarios; abort.
- `src/App.test.tsx`: form validation and focus management, demo result rendering, keyword/sentiment/trend evidence selection, sentiment filter, load more, and every error state.

## Project structure

```
src/
  api/          Typed contract: domain types, AnalysisService interface, error model
  mock/         Deterministic DEMO DATA generator + mock AnalysisService
  hooks/        useAnalysis (run/abort lifecycle), useComments (paged evidence)
  lib/          Pure helpers: dates, formatting, form validation
  components/   Reusable UI: Card, SegmentedControl, badges, SentimentBar, icons
  dashboard/    Feature UI: form, status views, summary, charts, keywords, evidence
  styles/       Design tokens (light + dark) and base styles
docs/
  api-contract.md   Proposed backend contract and open questions
```

## Connecting the real backend (later)

1. Agree the schema in [`docs/api-contract.md`](docs/api-contract.md) with the backend team.
2. Implement `AnalysisService` (`src/api/service.ts`) over `fetch`, mapping failures to `AnalysisError` codes.
3. Return it from `createAnalysisService()` in `src/api/index.ts` (e.g. when `VITE_API_BASE_URL` is set).

Components never import the mock directly, except the demo-channel shortcuts in
`App.tsx`, which only appear while `service.source === 'demo'`.

## Accessibility

- Native form controls with labels. Errors are linked via `aria-describedby`, and the first invalid field receives focus on submit.
- Every chart has a **View as table** alternative whose cells are buttons, so all evidence is reachable by keyboard.
- Sentiment and period are never shown by color alone: every colored mark sits beside a text label.
- Chart colors were checked for color-vision deficiency and contrast in light and dark modes. Text meets WCAG AA contrast.
- Supports `prefers-color-scheme`, `prefers-reduced-motion`, and `forced-colors`.

## Known limitations (Phase 1)

- Demo data only; no HTTP client yet (by design, until the contract is agreed).
- Demo evidence shows video titles without links, because demo video IDs are made up. YouTube links appear only for real (`source: "youtube"`) results.
- Periods are grouped by video publish date only. Comment-date grouping is reserved in the types but not exposed in the UI.
- No URL state yet: an analysis can't be shared by link.
