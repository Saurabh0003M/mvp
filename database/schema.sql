-- ============================================================================
-- Ascend — database schema (Supabase / PostgreSQL)
-- ============================================================================
-- Run this once in the Supabase SQL editor (or `supabase db execute`) on a
-- fresh project. It is idempotent where practical (create-if-not-exists,
-- on-conflict seed) so re-running is safe during a hackathon.
--
-- DESIGN PRINCIPLE — persist only what cannot be regenerated.
-- Four tables, no more:
--   profiles       — stated learning parameters (what the user told us)
--   aspirations    — "who you're trying to become"; interests = the goal set
--   content_items  — the generic learning corpus (video | article | flashcard)
--   interactions   — the primary learning signal (append-only swipe timeline)
--
-- There is deliberately NO belief_state table and NO insights table. Both are
-- pure functions of (profile, ordered interactions, corpus) and are recomputed
-- on demand by lib/server/*. Storing them would be caching a pure function.
-- There is NO roadmap table — the product has no roadmap feature.
--
-- AUTH: anonymous sign-in. Every profile row id equals auth.users.id, and RLS
-- scopes every read/write to the calling user. The content corpus is the one
-- thing everyone may read.
-- ============================================================================

-- Needed for gen_random_uuid(). Supabase ships it; create-if-not-exists is safe.
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- profiles — one row per (anonymous) user. id = auth.users.id.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  experience    text not null check (experience in ('Beginner', 'Intermediate', 'Advanced')),
  learning_style text not null check (learning_style in ('project', 'read', 'video', 'bite')),
  daily_time    integer not null check (daily_time in (15, 30, 60)),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- aspirations — a user may hold several over time; exactly one is primary.
-- `interests` is the category set the friction layer must never cross.
-- ----------------------------------------------------------------------------
create table if not exists public.aspirations (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  interests   text[] not null default '{}',
  is_primary  boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists aspirations_profile_id_idx on public.aspirations(profile_id);
-- At most one primary aspiration per user (partial unique index).
create unique index if not exists aspirations_one_primary_idx
  on public.aspirations(profile_id) where is_primary;

-- ----------------------------------------------------------------------------
-- content_items — the generic learning corpus.
-- `content_type` is a plain text column + CHECK, NOT an enum: adding a type
-- later is a one-line ALTER of the constraint, never a schema redesign. Keep
-- the CHECK list in sync with ALLOWED_CONTENT_TYPES in lib/taxonomy.ts.
--
-- `content_type` also serves as the routing key for future external API
-- integrations — the agentic AI layer uses it to decide which tool to invoke:
--   video     → YouTube API
--   article   → Article API
--   flashcard → Internal flashcard viewer
-- `source_url` provides the specific resource locator for each integration.
-- Adding a new provider for the same content_type (e.g. Vimeo for video)
-- needs only a `provider` column (simple ALTER), not a schema redesign.
--
-- `slug` is the stable id the engine keys on and MUST match the corpus ids.
-- `embedding` is future-ready storage (nullable, no pgvector dependency yet).
-- ----------------------------------------------------------------------------
create table if not exists public.content_items (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  description  text not null default '',
  goal_topic   text not null,
  content_type text not null check (content_type in ('video', 'article', 'flashcard')),
  format       text not null check (format in ('project', 'read', 'video', 'bite')),
  difficulty   text not null check (difficulty in ('Beginner', 'Intermediate', 'Advanced')),
  duration     integer not null default 15,
  source_url   text,
  tags         text[] not null default '{}',
  has_check    boolean not null default false,
  embedding    double precision[],  -- future-ready; nullable, unused by the MVP
  created_at   timestamptz not null default now()
);

create index if not exists content_items_goal_topic_idx on public.content_items(goal_topic);
create index if not exists content_items_content_type_idx on public.content_items(content_type);

-- ----------------------------------------------------------------------------
-- interactions — the append-only learning signal. The ONLY ground truth.
-- Denormalized (goal_topic/category/format/content_type/difficulty/tier) so
-- replay and drift detection need no joins and each row records what was true
-- AT SWIPE TIME (tier in particular is relative to the profile then).
-- Verbs: accept | skip | maybe_later are swipes; `completed` is a later row.
-- ----------------------------------------------------------------------------
create table if not exists public.interactions (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  aspiration_id    uuid references public.aspirations(id) on delete set null,
  content_slug     text not null,
  action           text not null check (action in ('accept', 'skip', 'maybe_later', 'completed')),
  goal_topic       text not null,
  category         text not null,
  format           text not null,
  content_type     text not null,
  difficulty       text not null,
  tier             text not null check (tier in ('stretch', 'bridge', 'easy')),
  time_to_swipe_ms integer,
  completed        boolean not null default false,
  completion_time_ms integer,
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);

-- Replay reads a user's rows in (created_at, id) order — index that path.
create index if not exists interactions_replay_idx
  on public.interactions(profile_id, created_at, id);

-- ----------------------------------------------------------------------------
-- keep profiles.updated_at fresh on every update
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- Row Level Security
-- ----------------------------------------------------------------------------
-- Every user (anonymous session) sees and writes ONLY their own rows. The
-- content corpus is world-readable but never client-writable — it is seeded by
-- a trusted service-role process (getServiceClient), which bypasses RLS.
-- ============================================================================

alter table public.profiles      enable row level security;
alter table public.aspirations   enable row level security;
alter table public.content_items enable row level security;
alter table public.interactions  enable row level security;

-- profiles: id IS the user id, so ownership is a direct equality check.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- aspirations: owned via profile_id.
drop policy if exists aspirations_select_own on public.aspirations;
create policy aspirations_select_own on public.aspirations
  for select using (auth.uid() = profile_id);

drop policy if exists aspirations_insert_own on public.aspirations;
create policy aspirations_insert_own on public.aspirations
  for insert with check (auth.uid() = profile_id);

drop policy if exists aspirations_update_own on public.aspirations;
create policy aspirations_update_own on public.aspirations
  for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists aspirations_delete_own on public.aspirations;
create policy aspirations_delete_own on public.aspirations
  for delete using (auth.uid() = profile_id);

-- interactions: owned via profile_id. Append-only in practice — no update/delete
-- policy is granted, so the timeline cannot be rewritten from the client.
drop policy if exists interactions_select_own on public.interactions;
create policy interactions_select_own on public.interactions
  for select using (auth.uid() = profile_id);

drop policy if exists interactions_insert_own on public.interactions;
create policy interactions_insert_own on public.interactions
  for insert with check (auth.uid() = profile_id);

-- content_items: readable by any authenticated user; not client-writable.
drop policy if exists content_items_select_all on public.content_items;
create policy content_items_select_all on public.content_items
  for select using (auth.role() = 'authenticated');

-- ============================================================================
-- Seed — the MVP content corpus.
-- ----------------------------------------------------------------------------
-- Generated from the SAME array the engine ships (lib/engine.ts RECOMMENDATIONS)
-- so every slug/format/category/difficulty matches bit-for-bit. That match is
-- the precondition for exact replay: interactions reference slugs, and the
-- server rebuilds engine state by replaying them against this corpus.
-- content_type is the accept-flow's concern only (video→player, article→reader,
-- flashcard→viewer) and never affects scoring; `project`/`read` both preview as
-- articles, `bite` as a flashcard, `video` as a video.
-- Run under the service role (RLS is not granted for content writes).
-- ============================================================================
insert into public.content_items
  (slug, title, description, goal_topic, content_type, format, difficulty, duration, source_url, tags, has_check)
values
  ('ai-1', 'Build a RAG Chatbot with LangChain', 'Construct a retrieval-augmented generation pipeline over your own documents and ship a working chatbot.', 'AI/ML', 'article', 'project', 'Intermediate', 60, NULL, ARRAY['llm', 'rag', 'python']::text[], true),
  ('ai-2', 'Train a Small Transformer from Scratch', 'Implement a minimal transformer in PyTorch and train it on a toy dataset to demystify attention.', 'AI/ML', 'article', 'project', 'Advanced', 60, NULL, ARRAY['transformer', 'pytorch']::text[], true),
  ('ai-3', 'Read: Attention Is All You Need', 'The landmark paper that introduced the transformer. Annotated guides make it approachable.', 'AI/ML', 'article', 'read', 'Advanced', 30, NULL, ARRAY['paper', 'transformer']::text[], true),
  ('ai-4', 'Watch: How GPT Models Work in 15 Min', 'A crisp visual explainer on tokenization, embeddings, and next-token prediction.', 'AI/ML', 'video', 'video', 'Beginner', 15, NULL, ARRAY['gpt', 'explainer']::text[], true),
  ('ai-5', 'Fine-tune an Open-Source LLM', 'Take a small open model and fine-tune it on a custom dataset using LoRA.', 'AI/ML', 'article', 'project', 'Advanced', 60, NULL, ARRAY['fine-tuning', 'lora']::text[], true),
  ('sec-1', 'Capture the Flag: Web Exploitation 101', 'Solve a guided set of web vulnerability challenges on a legal CTF platform.', 'Cybersecurity', 'article', 'project', 'Beginner', 30, NULL, ARRAY['ctf', 'web', 'owasp']::text[], true),
  ('sec-2', 'Read: The TAO of Network Security', 'A practical primer on packet inspection, firewalls, and zero-trust architecture.', 'Cybersecurity', 'article', 'read', 'Intermediate', 30, NULL, ARRAY['network', 'zero-trust']::text[], true),
  ('sec-3', 'Set Up a Home Lab with Suricata IDS', 'Spin up an intrusion-detection system and analyze real traffic captures.', 'Cybersecurity', 'article', 'project', 'Advanced', 60, NULL, ARRAY['ids', 'suricata', 'lab']::text[], true),
  ('sec-4', 'Watch: How Buffer Overflows Actually Work', 'A visual walkthrough of stack memory and a classic exploitation primitive.', 'Cybersecurity', 'video', 'video', 'Intermediate', 15, NULL, ARRAY['binary', 'exploitation']::text[], true),
  ('sec-5', 'Threat Modeling in 15 Minutes', 'Learn the STRIDE framework and threat-model a small app you already use.', 'Cybersecurity', 'flashcard', 'bite', 'Beginner', 15, NULL, ARRAY['stride', 'modeling']::text[], false),
  ('web-1', 'Build a Realtime Synced Todo App', 'Use CRDTs or WebSockets to build a multi-user todo list with live updates.', 'Web Dev', 'article', 'project', 'Intermediate', 60, NULL, ARRAY['realtime', 'websockets']::text[], true),
  ('web-2', 'Read: Rendering Patterns on the Modern Web', 'A deep dive on SSR, SSG, ISR, and streaming — when to reach for each.', 'Web Dev', 'article', 'read', 'Intermediate', 30, NULL, ARRAY['ssr', 'rendering']::text[], true),
  ('web-3', 'Ship a Full-Stack App with Server Actions', 'Build a small CRUD app using a modern framework''s server actions and forms.', 'Web Dev', 'article', 'project', 'Intermediate', 60, NULL, ARRAY['fullstack', 'server-actions']::text[], true),
  ('web-4', 'Watch: CSS Container Queries in 12 Min', 'A focused tour of container queries and where they beat media queries.', 'Web Dev', 'video', 'video', 'Beginner', 15, NULL, ARRAY['css', 'responsive']::text[], true),
  ('bball-1', 'Footwork Series: The Jab Step', 'A 15-minute drill progression to make your jab step a real threat.', 'Basketball', 'video', 'video', 'Beginner', 15, NULL, ARRAY['footwork', 'scoring']::text[], true),
  ('bball-2', 'Read: The Physics of the Jump Shot', 'Understand arc, release angle, and backspin to diagnose your own shot.', 'Basketball', 'article', 'read', 'Intermediate', 15, NULL, ARRAY['shooting', 'mechanics']::text[], true),
  ('bball-3', '30-Minute Scoring Workout', 'A structured solo workout: form shooting, pull-ups, and finishing at the rim.', 'Basketball', 'article', 'project', 'Intermediate', 30, NULL, ARRAY['workout', 'scoring']::text[], true),
  ('bball-4', 'Watch: How to Read a Pick & Roll', 'A film breakdown of guard-big interactions and defensive counters.', 'Basketball', 'video', 'video', 'Advanced', 15, NULL, ARRAY['film', 'bball-iq']::text[], true),
  ('design-1', 'Redesign a Screen You Hate', 'Pick one frustrating app screen and redesign it with a clear rationale.', 'Design', 'article', 'project', 'Intermediate', 30, NULL, ARRAY['ui', 'redesign']::text[], true),
  ('design-2', 'Read: Refactoring UI, Ch. 1–2', 'The foundational chapters on hierarchy, spacing, and visual design as engineering.', 'Design', 'article', 'read', 'Beginner', 30, NULL, ARRAY['visual-design', 'hierarchy']::text[], true),
  ('design-3', 'Watch: The Principles of Animation', 'A concise explainer on easing, timing, and choreography for interface motion.', 'Design', 'video', 'video', 'Beginner', 15, NULL, ARRAY['motion', 'animation']::text[], true),
  ('design-4', 'Build a Tiny Design System', 'Define tokens, primitives, and a few components for a fictional product.', 'Design', 'article', 'project', 'Advanced', 60, NULL, ARRAY['design-system', 'tokens']::text[], true),
  ('biz-1', 'Read: The Mom Test, Ch. 1–3', 'Learn to run customer interviews that surface truth instead of flattery.', 'Business', 'article', 'read', 'Beginner', 15, NULL, ARRAY['customer-dev', 'interviews']::text[], true),
  ('biz-2', 'Write a One-Page Lean Canvas', 'Sketch the business model for an idea you have in a single structured page.', 'Business', 'article', 'project', 'Beginner', 30, NULL, ARRAY['lean', 'model']::text[], true),
  ('biz-3', 'Watch: Pricing Strategy Fundamentals', 'A primer on value-based vs cost-plus pricing and how to choose.', 'Business', 'video', 'video', 'Intermediate', 15, NULL, ARRAY['pricing', 'strategy']::text[], true),
  ('biz-4', 'Read: Good Strategy / Bad Strategy, Intro', 'The kernel of strategy: diagnosis, guiding policy, and coherent action.', 'Business', 'article', 'read', 'Intermediate', 30, NULL, ARRAY['strategy']::text[], true),
  ('ds-1', 'Analyze a Kaggle Dataset End-to-End', 'Pick a dataset, clean it, explore it, and tell a story with one chart.', 'Data Science', 'article', 'project', 'Intermediate', 60, NULL, ARRAY['eda', 'pandas']::text[], true),
  ('ds-2', 'Read: Tidy Data by Hadley Wickham', 'The canonical paper on structuring datasets for analysis.', 'Data Science', 'article', 'read', 'Intermediate', 30, NULL, ARRAY['tidy-data', 'paper']::text[], true),
  ('ds-3', 'Watch: SQL Window Functions in 15 Min', 'Master the most powerful SQL feature with clear examples.', 'Data Science', 'video', 'video', 'Intermediate', 15, NULL, ARRAY['sql', 'window-functions']::text[], true),
  ('cw-1', 'Write a 500-Word Flash Fiction', 'A constrained daily prompt to build narrative instinct under pressure.', 'Creative Writing', 'article', 'project', 'Beginner', 15, NULL, ARRAY['fiction', 'prompt']::text[], true),
  ('cw-2', 'Read: On Writing, Ch. Toolbox', 'Stephen King''s practical toolkit on vocabulary, grammar, and dialogue.', 'Creative Writing', 'article', 'read', 'Beginner', 30, NULL, ARRAY['craft', 'toolkit']::text[], true),
  ('cw-3', 'Watch: The Shape of a Good Sentence', 'A short study of rhythm, cadence, and sentence-level revision.', 'Creative Writing', 'video', 'video', 'Intermediate', 15, NULL, ARRAY['style', 'revision']::text[], true)
on conflict (slug) do nothing;
