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

No API keys or environment variables are required — the recommendation engine runs fully client-side.

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
components/
  ascend/                Feature components (feed, card stack, insights, onboarding…)
  ui/                    shadcn/ui primitives
hooks/
  use-engine.ts          React binding around the recommendation engine
lib/
  engine.ts              The recommendation engine — scoring, learning loop, insights
```

## How the engine works

`lib/engine.ts` is the single source of truth for recommendation logic and is written to be swappable:

- **Weights & scoring** — each recommendation is scored from category and format weights; the queue re-sorts after every swipe.
- **Learning loop** — accept / skip / later nudge the relevant weights, which are normalized to 0–100 for the taste bars.
- **Insights** — consistency, contradiction, and emergence patterns are detected once they cross a threshold, each with real receipts from the session.

Two functions (`fetchRecommendations`, `getGroqExplanation`) are stubbed against local data today and marked with `TODO` comments for a future Supabase-backed corpus and LLM-generated explanations.

## License

MIT
