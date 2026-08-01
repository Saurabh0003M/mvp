# Ascend

A personalized growth-coaching web app. You tell Ascend what you're working toward, then swipe through a stack of learning "quests" — accept, save for later, or skip. Every swipe retrains a local recommendation engine in real time, and the app periodically surfaces **insights** ("you consistently pick video over reading", "your interests seem to be shifting toward Data Science") backed by receipts from your actual session.

Built as a hackathon MVP. The recommendation logic lives entirely in one pure-TypeScript module so a real database and LLM can be dropped in later without touching the UI.

## Features

- **Onboarding** — capture an aspiration, interests, experience level, learning style, and daily time budget.
- **Swipe-to-learn feed** — a card stack (keyboard + drag) that reorders itself after every interaction.
- **Live taste profile** — weighted bars that shift as the engine learns your preferences.
- **Insight sheet** — threshold-triggered observations you can apply to re-weight recommendations, or dismiss.
- **Quests shelf** — accepted and saved-for-later items, with the ability to resurface saved quests.

## Tech stack

- [Next.js 13](https://nextjs.org/) (App Router) + React 18
- TypeScript
- Tailwind CSS + [shadcn/ui](https://ui.shadcn.com/) (Radix primitives)
- [Framer Motion](https://www.framer.com/motion/) for animation
- [Lucide](https://lucide.dev/) icons

## Getting started

**Prerequisites:** [Node.js](https://nodejs.org/) 18 or newer (includes npm).

```bash
# 1. Clone the repository
git clone https://github.com/ishikakestwal/mvp.git
cd mvp

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Then open **http://localhost:3000** in your browser.

No API keys or environment variables are required to run the app — the recommendation engine runs fully client-side. Supabase persistence is **optional** and off by default; see [Backend](#backend-optional-supabase) below to enable it.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server on port 3000 |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check with the TypeScript compiler |

## Project structure

```
app/                     Next.js App Router entry (layout, page, global styles)
  api/                   Route Handlers — the optional backend API
    profile/             GET/POST the caller's profile + primary aspiration
    aspirations/         GET/POST aspirations
    recommendations/     GET the next cards in display order
    interactions/        GET history · POST a swipe or completion
    belief/              GET the computed belief state
    insights/            GET the current insight (+ dismissed/applied params)
components/
  ascend/                Feature components (feed, card stack, insights, onboarding…)
  ui/                    shadcn/ui primitives
database/
  schema.sql             Full schema: 4 tables, RLS, triggers, seeded corpus
hooks/
  use-engine.ts          React binding around the recommendation engine
  use-engine-persistence.ts  Optional Supabase mirror (no-op when unconfigured)
lib/
  engine.ts              The recommendation engine — scoring, learning loop, insights
  taxonomy.ts            Shared types, corpus vocabulary, runtime guards
  friction.ts            Friction/fatigue detection — "narrow the friction, not the topic"
  supabase/              Env-gated browser + server clients, row types
  services/              Data access (profile, aspiration, content, interaction, recommendation)
  server/                Server compute engines (replay, recommendation, belief, insight)
```

## How the engine works

`lib/engine.ts` is the single source of truth for recommendation logic and is written to be swappable:

- **Weights & scoring** — each recommendation is scored from category and format weights; the queue re-sorts after every swipe.
- **Learning loop** — accept / skip / later nudge the relevant weights, which are normalized to 0–100 for the taste bars.
- **Insights** — consistency, contradiction, and emergence patterns are detected once they cross a threshold, each with real receipts from the session.

Two functions (`fetchRecommendations`, `getGroqExplanation`) are stubbed against local data today and marked with `TODO` comments for a future Supabase-backed corpus and LLM-generated explanations.

## Backend (optional Supabase)

The backend is an **optional, additive** layer. When the Supabase environment
variables are absent, `getSupabaseClient()` returns `null`, every persistence
call becomes a no-op, and the app behaves exactly as the pure client-side MVP.
Setting the variables turns on anonymous-auth persistence with **no login UI**.

### What is (and isn't) persisted

The guiding rule is: **persist only what cannot be regenerated.** Four tables:

| Table | Purpose |
| --- | --- |
| `profiles` | Stated learning parameters (experience, style, daily time) |
| `aspirations` | "Who you're trying to become" — goal + interests; one is primary |
| `content_items` | The generic learning corpus (video · article · flashcard) |
| `interactions` | The append-only swipe timeline — the **primary learning signal** |

There is **no `belief_state` table and no `insights` table**. Both are pure
functions of `(profile, ordered interactions, corpus)` and are recomputed on
demand by `lib/server/*` — the engine state is a left fold of `applySwipe` over
the interaction history, so replay reproduces weights, cognitive state, and
insights exactly. There is **no roadmap feature** and no roadmap table.

### Setup

1. Create a project at [supabase.com](https://supabase.com/) and enable
   **Anonymous sign-ins** (Authentication → Providers → Anonymous).
2. In the SQL Editor, run the entire [`database/schema.sql`](database/schema.sql).
   It creates the four tables, RLS policies, the `updated_at` trigger, and seeds
   the 32-item content corpus. (Re-running is safe — it is idempotent.)
3. Copy `.env.local.example` to `.env.local` and fill in your project URL and
   anon key. The service-role key is only needed if you re-seed content from a
   script; the SQL seed above already covers the MVP.
4. Restart `npm run dev`. The app now persists to Supabase; existing UX is
   unchanged.

### API endpoints

All routes live under `app/api/`, require the anonymous bearer token, and share
one error contract: **503** unconfigured · **401** no session · **404** no
profile yet · **400** malformed body · **500** database error.

| Method & path | Description |
| --- | --- |
| `GET /api/profile` | The profile + primary aspiration id (404 if none) |
| `POST /api/profile` | Create/update profile + primary aspiration (onboarding) |
| `GET /api/aspirations` | List the caller's aspirations |
| `POST /api/aspirations` | Add an aspiration (`makePrimary` defaults true) |
| `GET /api/recommendations?limit=` | Next cards in display order + friction/tiers |
| `GET /api/interactions` | The swipe history in replay order |
| `POST /api/interactions` | Record a swipe (`direction`) or a completion |
| `GET /api/belief` | The computed belief state (weights, cognitive state…) |
| `GET /api/insights?dismissed=&applied=` | The current insight, if any |

### The friction layer — "narrow the friction, not the topic"

When a user repeatedly skips difficult content **in their chosen goal**, the
system infers *friction/fatigue*, not loss of interest, and responds by lowering
difficulty while keeping the same goal (e.g. Backend article → Backend
flashcards → short Backend video), never by switching topics. This is a
lightweight, **rule-based** detector (`lib/friction.ts`) — deliberately not an ML
model. The **hard rule** — never autonomously recommend off-goal content — is
enforced structurally: `applyFrictionRerank`'s first sort key makes off-goal
items unable to outrank on-goal ones, and the friction insight only ever nudges
*format*, never category. This holds on both the client and the server, and is a
retrieval invariant a future AI ranker must preserve.

### Testing the backend

```bash
# Type-check the whole backend + frontend
npm run typecheck

# With Supabase configured and the dev server running, exercise a route.
# Grab an anon access token from the browser devtools (Application → Local
# Storage → sb-*-auth-token → access_token) and:
curl -s http://localhost:3000/api/recommendations \
  -H "Authorization: Bearer <access_token>" | jq

# Unconfigured, every route returns 503 by design:
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/belief   # 503
```

### Connecting future frontend features

- **Rehydrate on return:** call `loadHistory()` from `use-engine-persistence`
  (or `GET /api/interactions`) and feed the result through the engine to restore
  a returning user's exact state.
- **Content viewers:** on accept, branch on `card.contentType`
  (`video` → player, `article` → reader, `flashcard` → viewer) and open
  `card.sourceUrl`. These optional fields already ride along on every
  recommendation.
- **Completion signal:** call `recordContentCompletion(card, ms)` from a viewer's
  "done" action to log the strongest engagement signal.
- **Real retrieval/LLM:** swap the body of `fetchCorpus` (or the server
  recommendation engine) for an embedding/ANN query or an LLM re-ranker — keep
  the `Recommendation[]` return type and the on-goal invariant.

## License

MIT
