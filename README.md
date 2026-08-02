# Ascend

Ascend is a personalized growth-coaching web app. A user names who they are trying to become, picks the areas that matter to them, and then swipes through a finite deck of curated learning quests. Every swipe updates a local recommendation engine, a live taste profile, and a small cognitive/wellbeing state that helps the app decide whether to push, soften, or pivot.

**Live demo:** [https://mvp-blond-five.vercel.app/](https://mvp-blond-five.vercel.app/)

The MVP runs without accounts, API keys, or a database. Supabase persistence, YouTube corpus ingestion, and a local Whisper speech server are optional integrations layered around the same client-side engine.

## What It Does

- **Three-step onboarding:** capture aspiration, interests, and experience level.
- **Swipe deck:** drag or use arrow keys to accept, skip, or save cards for later.
- **Immediate payoff:** accepting a card opens the matching viewer: video, music, podcast, article/source link, practice checklist, or mentor profile.
- **Personalized ranking:** every interaction reweights category and format preferences, then reorders the deck.
- **Explore grid:** browse the full curated media corpus by IABTM-style channels: Film, Music, Art, Animation, Editorial, and Print.
- **Taste & Wellbeing view:** see live preference weights plus a Ryff-inspired six-axis wellbeing radar.
- **Insights and notifications:** detect consistency, contradiction, friction, and cognitive pivot signals with receipts.
- **Voice coach:** speak or type how you feel; the coach extracts intent and retunes the feed. It uses Web Speech by default and can use a local `whisper-flow` WebSocket when configured.
- **Quests shelf:** accepted quests and saved-for-later cards are kept in session and can be resurfaced.
- **Optional persistence:** with Supabase configured, anonymous-auth sessions mirror profile, aspiration, swipes, and completion events.

## Tech Stack

- [Next.js 13](https://nextjs.org/) App Router + React 18
- TypeScript with strict mode
- Tailwind CSS + shadcn/ui Radix primitives
- Framer Motion for card, drawer, and transition animation
- Recharts for the wellbeing radar
- Supabase for optional anonymous persistence
- YouTube Data API v3 for optional corpus ingestion
- Lucide icons

## Quick Start

**Prerequisite:** Node.js 18 or newer.

```bash
git clone https://github.com/ishikakestwal/mvp.git
cd mvp
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For the Windows demo workflow, `npm start` runs `scripts/dev.mjs`: it frees the selected port, starts `next dev`, opens the browser, and cleans up the process tree on exit.

```bash
npm start
npm start -- 3001
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the standard Next.js development server |
| `npm start` | Start the custom local demo launcher from `scripts/dev.mjs` |
| `npm run build` | Create a production build |
| `npm run start:prod` | Serve the production build with `next start` |
| `npm run lint` | Run Next.js ESLint |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run ingest` | Regenerate `data/corpus.json` from the YouTube Data API |

## Project Structure

```text
app/
  page.tsx                  Client entry: onboarding or Discover app
  layout.tsx                Metadata, fonts, global layout
  api/                      Optional Supabase-backed route handlers
components/ascend/
  AppShell.tsx              Persistent left nav and right context rail
  OnboardingFlow.tsx        Aspiration, interests, experience setup
  Discover.tsx              Home, Explore, Taste tabs and overlays
  CardStack.tsx             Swipe/keyboard deck and cooling card
  RecommendationCard.tsx    Curiosity-led card UI and "why this" copy
  ContentViewer.tsx         Video/music/podcast/article/practice/mentor viewer
  VoiceCoach.tsx            Speech/text coach overlay
  TasteProfileRail.tsx      Live preference bars
  WellbeingRadar.tsx        Ryff-inspired radar chart
  QuestsShelf.tsx           Accepted and maybe-later drawers
  SearchSheet.tsx           Local corpus search
  NotificationsSheet.tsx    Insights and cognitive pivots
hooks/
  use-engine.ts             React state wrapper around the engine
  use-engine-persistence.ts Optional Supabase mirror
  use-speech.ts             Web Speech / whisper-flow / typing fallback
lib/
  engine.ts                 Main ranking, learning, insights, voice intent
  taxonomy.ts               Shared domain types and runtime guards
  cognitive.ts              Compressed Cognitive State and wellbeing estimate
  friction.ts               "Narrow the friction, not the topic" layer
  dpp.ts                    Determinantal Point Process diversity rerank
  voice.ts                  Transcript intent extraction and coach reply
  services/                 Supabase data access functions
  server/                   API-side replay, recommendation, belief, insight engines
  supabase/                 Browser/server clients and generated DB types
data/
  corpus.json               Generated YouTube metadata corpus
database/
  schema.sql                Optional Supabase schema, RLS, and seed data
scripts/
  dev.mjs                   Windows-friendly demo launcher
  ingest.mjs                YouTube ingestion pipeline
```

## Recommendation Architecture

The app keeps one source of truth for recommendation behavior in `lib/engine.ts`.

- **Corpus:** `LIVE_CORPUS` combines `data/corpus.json` with the curated fallback entries in `RECOMMENDATIONS`. The current fallback list is intentionally media/experience/mentor focused: `mus-*`, `pod-*`, `exp-*`, and `men-*`.
- **Scoring:** cards are scored from category weights, format weights, seen-state penalty, and a small eudaimonic bonus from the cognitive layer.
- **Learning:** `accept`, `skip`, and `later` mutate weights and counters, normalize them to 0-100, append an interaction, and re-sort the queue.
- **Diversity:** after relevance sorting, a Determinantal Point Process rerank prevents the deck from collapsing into near-duplicates.
- **Friction:** repeated skips of stretch content inside a stated goal lower effort in the same topic rather than switching topics.
- **Insights:** consistency, contradiction, emergence, and friction patterns fire only after thresholded behavior and include receipts from the session.
- **Voice intent:** typed or spoken text is parsed into mode/category/format signals, then applied through the same weight and queue pipeline as swipes.

`fetchRecommendations()` and `getGroqExplanation()` are async seams for future external retrieval/LLM work. In this MVP they return local corpus data and templated, grounded explanation copy.

## Content Corpus

The checked-in `data/corpus.json` contains 70 metadata-only YouTube items generated from `scripts/ingest.mjs`:

| Channel | Items |
| --- | ---: |
| Film | 12 |
| Music | 7 |
| Art | 12 |
| Animation | 14 |
| Editorial | 14 |
| Print | 11 |

The app does not re-host media. It stores titles, descriptions, thumbnails, tags, duration, source URLs, and embed URLs; playback uses the rightsholder's embedded player.

To regenerate the corpus:

```bash
# .env.local
YOUTUBE_API_KEY=your_youtube_data_api_key

npm run ingest
```

## Optional Environment Variables

All variables are optional. With none set, the app still runs as a fully client-side MVP.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | App + API | Enables Supabase client/server access |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | App + API | Enables anonymous auth and RLS-scoped persistence |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only trusted tasks | Optional privileged key for seed/admin scripts |
| `YOUTUBE_API_KEY` | `npm run ingest` | Regenerates `data/corpus.json` |
| `NEXT_PUBLIC_WHISPER_WS` | `use-speech.ts` | Optional local `whisper-flow` WebSocket, e.g. `ws://localhost:8000/ws` |

Copy `.env.local.example` to `.env.local` for the Supabase variables. Add `YOUTUBE_API_KEY` or `NEXT_PUBLIC_WHISPER_WS` only if you need those optional workflows.

## Optional Supabase Backend

Supabase is additive. When the public Supabase variables are missing, `getSupabaseClient()` returns `null`, the persistence hook no-ops, and the product behaves like a local-only demo.

When configured, the app silently creates an anonymous Supabase session and mirrors durable user events.

### Persisted Tables

| Table | Purpose |
| --- | --- |
| `profiles` | Experience level, learning style, and daily time defaults |
| `aspirations` | "Who you're becoming" plus selected interests; one primary aspiration |
| `content_items` | Generic video/article/flashcard corpus storage for future retrieval |
| `interactions` | Append-only accept/skip/maybe-later/completed event timeline |

There is no `belief_state`, `insights`, or `roadmap` table. Belief state, recommendations, friction, and insights are recomputed from `(profile, ordered interactions, corpus)`.

### Setup

1. Create a Supabase project.
2. Enable anonymous sign-ins in Authentication -> Providers -> Anonymous.
3. Run the full [`database/schema.sql`](database/schema.sql) file in the SQL editor.
4. Copy `.env.local.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Restart the dev server.

### API Routes

All API routes live under `app/api/`, require a bearer token from the anonymous Supabase session, and return a shared error shape: `503` unconfigured, `401` unauthorized, `404` no profile yet, `400` invalid input, `500` database/server failure.

| Method & path | Description |
| --- | --- |
| `GET /api/profile` | Load the profile and primary aspiration id |
| `POST /api/profile` | Create/update profile and primary aspiration from onboarding |
| `GET /api/aspirations` | List aspirations, primary first |
| `POST /api/aspirations` | Add an aspiration, defaulting to primary |
| `GET /api/recommendations?limit=20` | Return the next ranked cards, tiers, and friction state |
| `GET /api/interactions` | Return replay-ready swipe history |
| `POST /api/interactions` | Record a swipe or completion event |
| `GET /api/belief` | Return computed weights, counters, CCS, trajectory, and friction |
| `GET /api/insights?dismissed=&applied=` | Return the current computed insight, if any |

Example API call with Supabase configured:

```bash
curl -s http://localhost:3000/api/recommendations \
  -H "Authorization: Bearer <access_token>"
```

Without Supabase configured, API routes intentionally return `503` while the UI remains usable.

## Speech Input

The coach uses one hook with three fallback levels:

1. `NEXT_PUBLIC_WHISPER_WS` set and reachable: stream microphone PCM to a local `whisper-flow` WebSocket.
2. Browser Web Speech API available: use native speech recognition.
3. Neither available: use the text composer.

No branch changes the engine contract. The final transcript is passed to `applyVoiceIntent()`, which adjusts weights and reorders the same queue.

## Verification

Use these before shipping:

```bash
npm run typecheck
npm run build
```

On Windows PowerShell, if `npm` is blocked by execution policy, use the same commands through `npm.cmd`:

```bash
npm.cmd run typecheck
npm.cmd run build
```

## License

MIT
