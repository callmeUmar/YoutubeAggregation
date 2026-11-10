# YouTube Channel Comment Analyzer — Backend

A creator enters a YouTube channel and two date ranges. The dashboard then shows
how comment sentiment and top keywords changed between the two ranges. No
generative AI is used: every number is a count of labeled comments, and every
number links to the real comments behind it.

This repo holds the **backend and data layer** (FastAPI + SQLAlchemy). Analysis
(sentiment and keywords) and the React dashboard are owned by teammates. They
plug in through `backend/analysis_stub/` and the HTTP API.

> Status: **Stage 1 (setup)**. Database schema and `GET /health` are in place.
> Data collection, `/analyses` and rate limiting come in later stages.

## Quick start (Docker)

You need Docker with Compose v2 and a YouTube Data API v3 key.

```bash
git clone <repo-url> && cd <repo>
cp .env.example .env          # then put your key in YOUTUBE_API_KEY=
docker compose up --build
curl http://localhost:8000/health
# {"ok":true,"quotaUsedToday":0}
```

Interactive API docs: http://localhost:8000/docs

The SQLite database lives in the `backend-data` Docker volume. It survives
restarts. Delete it with `docker compose down -v`.

### Getting an API key

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. Open **APIs & Services → Library**, search for **YouTube Data API v3**, and click **Enable**.
3. Open **APIs & Services → Credentials**, then **Create credentials → API key**.
4. Paste the key into `.env`. **Never commit `.env`.** It is git-ignored.

## Local development (no Docker)

Requires Python 3.11+.

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn backend.api.main:create_app --factory --reload
```

## Tests

```bash
pytest
```

Tests use an in-memory SQLite database. They **never** call the live YouTube
API. Outbound network access is blocked in `tests/conftest.py`, and recorded API
responses go in `fixtures/`.

## Configuration

All settings are environment variables, read from `.env` (see `.env.example`).

| Variable           | Default                                         | Meaning                                                            |
|--------------------|-------------------------------------------------|--------------------------------------------------------------------|
| `YOUTUBE_API_KEY`  | *(empty)*                                       | YouTube Data API v3 key                                            |
| `DATABASE_URL`     | `sqlite:///./data/app.db`                       | SQLAlchemy URL; Docker overrides it to a path inside the volume    |
| `CORS_ORIGINS`     | `["http://localhost:5173","http://localhost:3000"]` | Browser origins allowed to call the API                        |
| `QUOTA_SOFT_LIMIT` | `8000`                                          | Above this many units in one Pacific-time day, serve cached data only |

## Repository layout

```
backend/
  api/            FastAPI app factory, routes, Pydantic schemas (camelCase JSON)
  youtube/        YouTube Data API client                      (Stage 2)
  db/             SQLAlchemy models, session, quota bookkeeping
  analysis_stub/  analyze(comments, periods) -> dict contract  (Stage 3)
  config.py       Settings loaded from env / .env
fixtures/         Saved YouTube API responses used by tests
tests/
Dockerfile, docker-compose.yml
```

## API

### `GET /health`

```json
{ "ok": true, "quotaUsedToday": 0 }
```

`quotaUsedToday` is the number of YouTube API units spent in the current
**quota day**. The quota day resets at midnight Pacific time
(`America/Los_Angeles`, DST-aware). Every API call costs 1 unit.

## Data model

| Table         | Key             | Notes |
|---------------|-----------------|-------|
| `channels`    | `id` (`UC…`)    | `handle` (lowercase, no `@`), `uploads_playlist_id`, `last_refreshed_at` (for the 24-hour refresh rule) |
| `videos`      | `id`            | `channel_id`, **`published_at`**, `comment_count`, `skip_reason` (e.g. comments disabled), `comments_fetched_at` |
| `comments`    | `id`            | `video_id`, `parent_id` (NULL = top-level, set = reply), `text`, `like_count`, **`published_at`** |
| `analyses`    | `key`           | Deterministic hash of channel + both periods; the periods themselves, `status` (`queued`/`running`/`done`/`error`), `progress` 0–100, `step`, `error_code`, `error_message`, `result_json`, `updated_at` |
| `quota_usage` | `day`           | Units spent per Pacific-time quota day |

The comment date and the video publish date are both stored, so grouping can
switch between "when the comment was written" and "when its video was
published".

Design notes:
- YouTube's own IDs are the primary keys.
- All timestamps are timezone-aware UTC, on SQLite as well as Postgres.
- Enums are stored as `VARCHAR` with a `CHECK` constraint, not native enums.
  The same schema therefore runs on SQLite (dev) and Postgres.
- Foreign keys are enforced on SQLite too (`PRAGMA foreign_keys=ON`).
# YoutubeAggregation
