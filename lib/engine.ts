// All the recommendation logic lives here. Keeping it in one file means we can
// swap the local corpus for Supabase and the templated "why" strings for a real
// LLM later without the UI needing to change.

// ---------------------------------------------------------------------------
// The shared vocabulary (types, category/format constants, corpus taxonomy)
// now lives in ./taxonomy. We re-export it wholesale so every existing
// `import { ... } from "@/lib/engine"` in the UI keeps resolving unchanged, and
// separately import the symbols this module needs internally.
// ---------------------------------------------------------------------------

export * from "./taxonomy";

import corpus from "@/data/corpus.json";
import {
  ALL_CATEGORIES,
  ALL_FORMATS,
  FORMAT_LABELS,
  CATEGORY_ACCENTS,
  IABTM_CHANNELS,
  isCategory,
  isFormat,
  type Category,
  type Difficulty,
  type Format,
  type IabtmChannel,
  type MediaKind,
  type Recommendation,
  type UserProfile,
  type SwipeDirection,
  type Interaction,
  type Weights,
  type Counters,
} from "./taxonomy";

import {
  compressCognitiveState,
  eudaimonicBonus,
  contentAxes,
  AXIS_ORDER,
  type CompressedCognitiveState,
} from "./cognitive";

import { greedyMapDpp, type DppItem } from "./dpp";

import { extractIntent, type VoiceReading } from "./voice";

import {
  detectFriction,
  applyFrictionRerank,
  isFrictionSkip,
  contentTier,
  FRICTION_THRESHOLD,
} from "./friction";

const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"] as const satisfies readonly Difficulty[];
const MEDIA_KINDS = ["video", "music", "podcast", "article", "practice", "mentor"] as const satisfies readonly MediaKind[];

function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(value);
}

function isIabtmChannel(value: string): value is IabtmChannel {
  return (IABTM_CHANNELS as readonly string[]).includes(value);
}

function isMediaKind(value: string): value is MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(value);
}

type IngestedCorpusItem = (typeof corpus.items)[number];

function toIngestedRecommendation(item: IngestedCorpusItem): Recommendation | null {
  if (
    !isCategory(item.category) ||
    !isFormat(item.format) ||
    !isDifficulty(item.difficulty) ||
    !isIabtmChannel(item.channel)
  ) {
    return null;
  }

  return {
    id: item.id,
    hook: item.hook,
    title: item.title,
    description: item.description,
    category: item.category,
    channel: item.channel,
    format: item.format,
    difficulty: item.difficulty,
    duration: item.duration,
    tags: item.tags,
    mediaKind: isMediaKind(item.mediaKind) ? item.mediaKind : undefined,
    embedUrl: item.embedUrl,
    thumbnail: item.thumbnail,
    source: item.source,
    sourceUrl: item.sourceUrl ?? null,
  };
}

export const INGESTED: Recommendation[] = corpus.items
  .map(toIngestedRecommendation)
  .filter((card): card is Recommendation => card !== null);

export interface EngineState {
  weights: Weights;
  counters: Counters;
  queue: Recommendation[];
  accepted: Recommendation[];
  later: Recommendation[];
  history: Interaction[];
  seen: Set<string>;
  dismissedInsights: Set<string>;
  appliedInsights: Set<string>;
  /** The most recent voice reading, surfaced by the conversational coach. */
  lastReading: VoiceReading | null;
}

export interface Insight {
  id: string;
  kind: "consistency" | "contradiction" | "emergence" | "friction";
  headline: string;
  body: string;
  receipts: string;
  target?: { type: "format" | "category"; value: string };
  delta?: number;
}

// ALL_CATEGORIES, ALL_FORMATS, FORMAT_LABELS, and CATEGORY_ACCENTS now live in
// ./taxonomy and are re-exported above.

// Starter corpus, ~28 items. Hardcoded for now until we have a real DB.

export const RECOMMENDATIONS: Recommendation[] = [
  // AI/ML
  { id: "ai-1", hook: "Everyone talks about RAG. Almost nobody has built one.", title: "Build a RAG Chatbot with LangChain", description: "Construct a retrieval-augmented generation pipeline over your own documents and ship a working chatbot.", category: "AI/ML", format: "project", difficulty: "Intermediate", duration: 60, tags: ["llm", "rag", "python"] },
  { id: "ai-2", title: "Train a Small Transformer from Scratch", description: "Implement a minimal transformer in PyTorch and train it on a toy dataset to demystify attention.", category: "AI/ML", format: "project", difficulty: "Advanced", duration: 60, tags: ["transformer", "pytorch"] },
  { id: "ai-3", title: "Read: Attention Is All You Need", description: "The landmark paper that introduced the transformer. Annotated guides make it approachable.", category: "AI/ML", format: "read", difficulty: "Advanced", duration: 30, tags: ["paper", "transformer"] },
  { id: "ai-4", hook: "It predicts one word at a time. So why does it feel like it thinks?", title: "Watch: How GPT Models Work in 15 Min", description: "A crisp visual explainer on tokenization, embeddings, and next-token prediction.", category: "AI/ML", format: "video", difficulty: "Beginner", duration: 15, tags: ["gpt", "explainer"] },
  { id: "ai-5", title: "Fine-tune an Open-Source LLM", description: "Take a small open model and fine-tune it on a custom dataset using LoRA.", category: "AI/ML", format: "project", difficulty: "Advanced", duration: 60, tags: ["fine-tuning", "lora"] },

  // Cybersecurity
  { id: "sec-1", hook: "The fastest way to learn defence is to break something first.", title: "Capture the Flag: Web Exploitation 101", description: "Solve a guided set of web vulnerability challenges on a legal CTF platform.", category: "Cybersecurity", format: "project", difficulty: "Beginner", duration: 30, tags: ["ctf", "web", "owasp"] },
  { id: "sec-2", title: "Read: The TAO of Network Security", description: "A practical primer on packet inspection, firewalls, and zero-trust architecture.", category: "Cybersecurity", format: "read", difficulty: "Intermediate", duration: 30, tags: ["network", "zero-trust"] },
  { id: "sec-3", title: "Set Up a Home Lab with Suricata IDS", description: "Spin up an intrusion-detection system and analyze real traffic captures.", category: "Cybersecurity", format: "project", difficulty: "Advanced", duration: 60, tags: ["ids", "suricata", "lab"] },
  { id: "sec-4", title: "Watch: How Buffer Overflows Actually Work", description: "A visual walkthrough of stack memory and a classic exploitation primitive.", category: "Cybersecurity", format: "video", difficulty: "Intermediate", duration: 15, tags: ["binary", "exploitation"] },
  { id: "sec-5", hook: "Name five ways someone could abuse the app on your phone.", title: "Threat Modeling in 15 Minutes", description: "Learn the STRIDE framework and threat-model a small app you already use.", category: "Cybersecurity", format: "bite", difficulty: "Beginner", duration: 15, tags: ["stride", "modeling"] },

  // Web Dev
  { id: "web-1", title: "Build a Realtime Synced Todo App", description: "Use CRDTs or WebSockets to build a multi-user todo list with live updates.", category: "Web Dev", format: "project", difficulty: "Intermediate", duration: 60, tags: ["realtime", "websockets"] },
  { id: "web-2", hook: "Four rendering strategies. Most developers can only defend one.", title: "Read: Rendering Patterns on the Modern Web", description: "A deep dive on SSR, SSG, ISR, and streaming — when to reach for each.", category: "Web Dev", format: "read", difficulty: "Intermediate", duration: 30, tags: ["ssr", "rendering"] },
  { id: "web-3", title: "Ship a Full-Stack App with Server Actions", description: "Build a small CRUD app using a modern framework's server actions and forms.", category: "Web Dev", format: "project", difficulty: "Intermediate", duration: 60, tags: ["fullstack", "server-actions"] },
  { id: "web-4", title: "Watch: CSS Container Queries in 12 Min", description: "A focused tour of container queries and where they beat media queries.", category: "Web Dev", format: "video", difficulty: "Beginner", duration: 15, tags: ["css", "responsive"] },

  // Basketball
  { id: "bball-1", title: "Footwork Series: The Jab Step", description: "A 15-minute drill progression to make your jab step a real threat.", category: "Basketball", format: "video", difficulty: "Beginner", duration: 15, tags: ["footwork", "scoring"] },
  { id: "bball-2", hook: "Your shot has a physics problem, not a confidence problem.", title: "Read: The Physics of the Jump Shot", description: "Understand arc, release angle, and backspin to diagnose your own shot.", category: "Basketball", format: "read", difficulty: "Intermediate", duration: 15, tags: ["shooting", "mechanics"] },
  { id: "bball-3", title: "30-Minute Scoring Workout", description: "A structured solo workout: form shooting, pull-ups, and finishing at the rim.", category: "Basketball", format: "project", difficulty: "Intermediate", duration: 30, tags: ["workout", "scoring"] },
  { id: "bball-4", title: "Watch: How to Read a Pick & Roll", description: "A film breakdown of guard-big interactions and defensive counters.", category: "Basketball", format: "video", difficulty: "Advanced", duration: 15, tags: ["film", "bball-iq"] },

  // Design
  { id: "design-1", title: "Redesign a Screen You Hate", description: "Pick one frustrating app screen and redesign it with a clear rationale.", category: "Design", format: "project", difficulty: "Intermediate", duration: 30, tags: ["ui", "redesign"] },
  { id: "design-2", hook: "Good design is mostly deciding what to remove.", title: "Read: Refactoring UI, Ch. 1–2", description: "The foundational chapters on hierarchy, spacing, and visual design as engineering.", category: "Design", format: "read", difficulty: "Beginner", duration: 30, tags: ["visual-design", "hierarchy"] },
  { id: "design-3", title: "Watch: The Principles of Animation", description: "A concise explainer on easing, timing, and choreography for interface motion.", category: "Design", format: "video", difficulty: "Beginner", duration: 15, tags: ["motion", "animation"] },
  { id: "design-4", title: "Build a Tiny Design System", description: "Define tokens, primitives, and a few components for a fictional product.", category: "Design", format: "project", difficulty: "Advanced", duration: 60, tags: ["design-system", "tokens"] },

  // Business
  { id: "biz-1", hook: "Your friends lied about your idea. Politely.", title: "Read: The Mom Test, Ch. 1–3", description: "Learn to run customer interviews that surface truth instead of flattery.", category: "Business", format: "read", difficulty: "Beginner", duration: 15, tags: ["customer-dev", "interviews"] },
  { id: "biz-2", title: "Write a One-Page Lean Canvas", description: "Sketch the business model for an idea you have in a single structured page.", category: "Business", format: "project", difficulty: "Beginner", duration: 30, tags: ["lean", "model"] },
  { id: "biz-3", title: "Watch: Pricing Strategy Fundamentals", description: "A primer on value-based vs cost-plus pricing and how to choose.", category: "Business", format: "video", difficulty: "Intermediate", duration: 15, tags: ["pricing", "strategy"] },
  { id: "biz-4", title: "Read: Good Strategy / Bad Strategy, Intro", description: "The kernel of strategy: diagnosis, guiding policy, and coherent action.", category: "Business", format: "read", difficulty: "Intermediate", duration: 30, tags: ["strategy"] },

  // Data Science
  { id: "ds-1", hook: "A chart that changes someone's mind beats a model that doesn't ship.", title: "Analyze a Kaggle Dataset End-to-End", description: "Pick a dataset, clean it, explore it, and tell a story with one chart.", category: "Data Science", format: "project", difficulty: "Intermediate", duration: 60, tags: ["eda", "pandas"] },
  { id: "ds-2", title: "Read: Tidy Data by Hadley Wickham", description: "The canonical paper on structuring datasets for analysis.", category: "Data Science", format: "read", difficulty: "Intermediate", duration: 30, tags: ["tidy-data", "paper"] },
  { id: "ds-3", title: "Watch: SQL Window Functions in 15 Min", description: "Master the most powerful SQL feature with clear examples.", category: "Data Science", format: "video", difficulty: "Intermediate", duration: 15, tags: ["sql", "window-functions"] },

  // Creative Writing
  { id: "cw-1", hook: "500 words. One sitting. No editing until it's done.", title: "Write a 500-Word Flash Fiction", description: "A constrained daily prompt to build narrative instinct under pressure.", category: "Creative Writing", format: "project", difficulty: "Beginner", duration: 15, tags: ["fiction", "prompt"] },
  { id: "cw-2", title: "Read: On Writing, Ch. Toolbox", description: "Stephen King's practical toolkit on vocabulary, grammar, and dialogue.", category: "Creative Writing", format: "read", difficulty: "Beginner", duration: 30, tags: ["craft", "toolkit"] },
  { id: "cw-3", title: "Watch: The Shape of a Good Sentence", description: "A short study of rhythm, cadence, and sentence-level revision.", category: "Creative Writing", format: "video", difficulty: "Intermediate", duration: 15, tags: ["style", "revision"] },

  // ==========================================================================
  // Media, knowledge AND experiences.
  // --------------------------------------------------------------------------
  // The problem statement asks for all three, and IABTM's own platform has
  // Artists, a podcast and Experts — not just reading lists. These items cover
  // the other media kinds: something to work to, someone to learn from, and
  // something to go and do. Each leads with a curiosity hook rather than a
  // topic label, because a feed of labels is a syllabus, not a curator.
  // ==========================================================================

  // Music / audio — state regulation. This is what the coach reaches for when
  // it hears "Burnt Out": you don't hand a burnt-out person a 60-minute lecture.
  { id: "mus-1", hook: "The sound engineers use to make a room disappear.", title: "Deep Focus: Brown Noise for Flow", description: "A 45-minute unbroken bed of brown noise — no melody to follow, so attention has nothing to chase.", category: "AI/ML", format: "bite", difficulty: "Beginner", duration: 45, tags: ["focus", "audio", "flow"], mediaKind: "music", embedUrl: "https://www.youtube.com/embed/RqzGzwTY-6w" },
  { id: "mus-2", hook: "Why do so many producers write to music with no words?", title: "Instrumental Study Session", description: "Lyric-free instrumental music. Language competes with language — remove the words and the writing gets easier.", category: "Creative Writing", format: "bite", difficulty: "Beginner", duration: 30, tags: ["focus", "audio", "writing"], mediaKind: "music", embedUrl: "https://www.youtube.com/embed/jfKfPfyJRdk" },
  { id: "mus-3", hook: "Ten minutes that reset a nervous system.", title: "Downshift: Recovery Audio", description: "Slow, low-tempo audio for the gap between finishing work and being a person again.", category: "Business", format: "bite", difficulty: "Beginner", duration: 10, tags: ["recovery", "audio", "rest"], mediaKind: "music", embedUrl: "https://www.youtube.com/embed/lTRiuFIWV54" },

  // Podcast — IABTM's own BeU Podcast is the integration hook here.
  { id: "pod-1", hook: "He left the US at 24 and never moved back. What did he see?", title: "BeU Podcast — The Departure to Japan", description: "Ashley Wallace on leaving everything familiar, learning a language from zero, and what courage actually costs.", category: "Business", format: "read", difficulty: "Beginner", duration: 40, tags: ["story", "courage", "iabtm"], mediaKind: "podcast", source: "IABTM" },
  { id: "pod-2", hook: "The Japanese repair broken pottery with gold. Why?", title: "BeU Podcast — Kintsugi (金継ぎ)", description: "The art of mending with gold, and what it argues about your own cracks. From IABTM's own podcast.", category: "Creative Writing", format: "read", difficulty: "Beginner", duration: 35, tags: ["resilience", "story", "iabtm"], mediaKind: "podcast", source: "IABTM" },

  // Experiences — the "go and do it" tier. Knowledge you can't get by consuming.
  { id: "exp-1", hook: "You've read enough. What breaks if you ship it today?", title: "Ship One Thing, Badly, In 60 Minutes", description: "Pick the smallest version of the thing you've been researching and put it in front of one real person.", category: "Business", format: "project", difficulty: "Intermediate", duration: 60, tags: ["execution", "shipping"], mediaKind: "practice", steps: ["Pick the smallest shippable slice — one screen, one paragraph, one function.", "Set a 45-minute timer. Build only that.", "Send it to exactly one person who will be honest.", "Write one sentence on what surprised you."] },
  { id: "exp-2", hook: "Your best ideas don't arrive at a desk.", title: "The Phoneless Walk", description: "Twenty minutes outside with no headphones and no phone. Diffuse-mode thinking is where insight is generated.", category: "Design", format: "bite", difficulty: "Beginner", duration: 20, tags: ["reflection", "walk", "wellbeing"], mediaKind: "practice", steps: ["Leave the phone. Actually leave it.", "Walk for 20 minutes with no destination.", "When you get back, write the first thing that surfaced."] },
  { id: "exp-3", hook: "Explain it to someone who doesn't care. Can you?", title: "The Feynman Hour", description: "Teach the thing you're learning to one person out loud. The place you stumble is the place you don't know it.", category: "AI/ML", format: "project", difficulty: "Beginner", duration: 30, tags: ["teaching", "retention"], mediaKind: "practice", steps: ["Choose a concept you think you understand.", "Explain it out loud to a person or a camera, no notes.", "Mark every sentence where you hesitated — that's your gap.", "Go read only about the gaps."] },

  // Mentors — "the right mentors at the right moment" is in the brief, and
  // IABTM already ships Experts and Artists tabs to plug into.
  { id: "men-1", hook: "Someone two years ahead of you has already solved this.", title: "Talk to a Security Researcher", description: "A 30-minute consultation with a working practitioner instead of another article about the field.", category: "Cybersecurity", format: "read", difficulty: "Intermediate", duration: 30, tags: ["mentor", "career", "iabtm"], mediaKind: "mentor", source: "IABTM", mentor: { name: "IABTM Expert", role: "Security Researcher · Expert consultation" } },
  { id: "men-2", hook: "The gap between good and hired is usually one conversation.", title: "Portfolio Review with a Designer", description: "Bring one piece of work. Leave with the specific reason it isn't landing yet.", category: "Design", format: "read", difficulty: "Intermediate", duration: 30, tags: ["mentor", "feedback", "iabtm"], mediaKind: "mentor", source: "IABTM", mentor: { name: "IABTM Artist", role: "Product Designer · Artists network" } },
];

export const LIVE_CORPUS: Recommendation[] = [...INGESTED, ...RECOMMENDATIONS];

// Set up a fresh engine for a new user.

function emptyCounters(): Counters {
  const categories = {} as Counters["categories"];
  for (const c of ALL_CATEGORIES) categories[c] = { accept: 0, skip: 0, later: 0 };
  const formats = {} as Counters["formats"];
  for (const f of ALL_FORMATS) formats[f] = { accept: 0, skip: 0, later: 0 };
  return { categories, formats };
}

export function createEngine(profile: UserProfile): EngineState {
  const weights = initialWeights(profile);
  const seen = new Set<string>();
  const queue = sortedQueue(LIVE_CORPUS.slice(), weights, profile, seen, []);
  return {
    weights,
    counters: emptyCounters(),
    queue,
    accepted: [],
    later: [],
    history: [],
    seen,
    dismissedInsights: new Set(),
    appliedInsights: new Set(),
    lastReading: null,
  };
}

function initialWeights(profile: UserProfile): Weights {
  const categories = {} as Record<Category, number>;
  for (const c of ALL_CATEGORIES) {
    categories[c] = profile.interests.includes(c) ? 65 : 30;
  }
  const formats = {} as Record<Format, number>;
  for (const f of ALL_FORMATS) {
    formats[f] = f === profile.learningStyle ? 70 : 35;
  }
  return { categories, formats };
}

// Scoring + queue ordering.

export function scoreCard(
  card: Recommendation,
  weights: Weights,
  seen: Set<string>,
  ccs?: CompressedCognitiveState | null,
  profile?: UserProfile
): number {
  const cat = weights.categories[card.category] ?? 0;
  const fmt = weights.formats[card.format] ?? 0;
  const repetition = seen.has(card.id) ? 25 : 0;
  const base = cat * 0.6 + fmt * 0.4 - repetition;
  // The eudaimonic layer tilts ranking toward the neglected wellbeing axis and
  // the active corrective pivot. Small by design — revealed taste still leads.
  const eudaimonic = ccs && profile ? eudaimonicBonus(card, ccs, profile) : 0;
  return base + eudaimonic;
}

function sortedQueue(
  cards: Recommendation[],
  weights: Weights,
  profile: UserProfile,
  seen: Set<string>,
  history: Interaction[]
): Recommendation[] {
  const ccs = compressCognitiveState(history, profile, LIVE_CORPUS);
  const scored = cards.map((c) => ({
    card: c,
    score: scoreCard(c, weights, seen, ccs, profile),
  }));
  // Relevance-first order — both the sensible fallback and the quality signal
  // the DPP consumes.
  scored.sort((a, b) => b.score - a.score);
  const diversified = diversify(scored, profile);

  // Friction layer — the FINAL ordering pass. If the user is skipping hard
  // ("stretch") items inside a goal they chose, bring easier same-topic items
  // forward so difficulty drops while the topic holds. This never injects
  // off-goal content and never lets a non-goal item outrank a goal item, so
  // the "narrow the friction, not the topic" rule is enforced structurally.
  const friction = detectFriction(history, profile, LIVE_CORPUS);
  return applyFrictionRerank(diversified, friction, profile);
}

// ---------------------------------------------------------------------------
// Diversity re-rank — a Determinantal Point Process over (category, format,
// wellbeing) features stops the feed from collapsing onto a single theme. The
// linear algebra lives in ./dpp; here we just build the features and quality.
// ---------------------------------------------------------------------------

function featureVector(card: Recommendation, profile: UserProfile): number[] {
  const cat = ALL_CATEGORIES.map((c) => (c === card.category ? 1 : 0));
  const fmt = ALL_FORMATS.map((f) => (f === card.format ? 1 : 0));
  const axes = contentAxes(card, profile);
  const wellbeing = AXIS_ORDER.map((a) => axes[a]);
  return [...cat, ...fmt, ...wellbeing];
}

function diversify(
  scored: { card: Recommendation; score: number }[],
  profile: UserProfile
): Recommendation[] {
  if (scored.length <= 2) return scored.map((s) => s.card);

  // The single best-scoring card is pinned to the front. Diversity matters
  // across the *deck*, but the card a user actually sees first should be the
  // most relevant one — otherwise the opening impression reads as off-target.
  const [lead, ...rest] = scored;
  if (rest.length <= 2) return scored.map((s) => s.card);
  return [lead.card, ...diversifyFrom(rest, profile)];
}

function diversifyFrom(
  scored: { card: Recommendation; score: number }[],
  profile: UserProfile
): Recommendation[] {
  // Map raw scores (which can go negative) into [0,1] quality for the kernel.
  const scores = scored.map((s) => s.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = max - min || 1;

  const items: DppItem[] = scored.map((s) => ({
    id: s.card.id,
    features: featureVector(s.card, profile),
    quality: (s.score - min) / span,
  }));

  const order = greedyMapDpp(items, items.length);
  const byId = new Map(scored.map((s) => [s.card.id, s.card]));
  const picked = new Set(order);
  const result = order.map((id) => byId.get(id)!).filter(Boolean);
  // Items the DPP stopped short of (judged redundant) trail in score order,
  // so nothing is ever dropped from the queue.
  for (const s of scored) {
    if (!picked.has(s.card.id)) result.push(s.card);
  }
  return result;
}

// This is where the learning happens: a swipe nudges the weights and requeues.

const SWEEP_MAGNITUDE: Record<SwipeDirection, number> = {
  accept: 1,
  skip: -1,
  later: -0.4,
};

export function applySwipe(
  state: EngineState,
  card: Recommendation,
  direction: SwipeDirection,
  profile: UserProfile
): EngineState {
  const mag = SWEEP_MAGNITUDE[direction];
  const LEARN = 9;

  const categories = { ...state.weights.categories };
  const formats = { ...state.weights.formats };

  // Friction-aware skip attribution. Skipping a HARD ("stretch") item inside a
  // goal the user chose is friction/fatigue, not disinterest — so it must NOT
  // erode that topic's category weight (otherwise repeated hard-skips would let
  // an off-goal category drift to the top, exactly what the product forbids).
  // The FORMAT weight still updates, so the engine learns they want the topic
  // in a lighter format. Every other swipe behaves exactly as before.
  const frictionSkip = isFrictionSkip(card, direction, profile);
  if (!frictionSkip) {
    categories[card.category] = clamp01(categories[card.category] + mag * LEARN);
  }
  formats[card.format] = clamp01(formats[card.format] + mag * LEARN);

  // Normalize so the top weight maps to 100 and others scale relatively.
  const norm = normalize({ categories, formats });

  const counters: Counters = {
    categories: { ...state.counters.categories },
    formats: { ...state.counters.formats },
  };
  counters.categories[card.category] = {
    ...counters.categories[card.category],
    [direction]: counters.categories[card.category][direction] + 1,
  };
  counters.formats[card.format] = {
    ...counters.formats[card.format],
    [direction]: counters.formats[card.format][direction] + 1,
  };

  const interaction: Interaction = {
    recommendationId: card.id,
    category: card.category,
    format: card.format,
    direction,
    timestamp: Date.now(),
  };

  const seen = new Set(state.seen);
  seen.add(card.id);

  const remaining = state.queue.filter((c) => c.id !== card.id);
  const accepted =
    direction === "accept" ? [card, ...state.accepted] : state.accepted;
  const later =
    direction === "later" ? [card, ...state.later] : state.later;

  const history = [...state.history, interaction];
  const queue = sortedQueue(remaining, norm, profile, seen, history);

  return {
    ...state,
    weights: norm,
    counters,
    queue,
    accepted,
    later,
    history,
    seen,
  };
}

export function reSurface(state: EngineState, cardId: string, profile: UserProfile): EngineState {
  const card = state.later.find((c) => c.id === cardId);
  if (!card) return state;
  return {
    ...state,
    later: state.later.filter((c) => c.id !== cardId),
    queue: sortedQueue([card, ...state.queue], state.weights, profile, state.seen, state.history),
  };
}

export function applyInsight(
  state: EngineState,
  insight: Insight,
  profile: UserProfile
): EngineState {
  if (!insight.target || insight.delta == null) return state;
  const categories = { ...state.weights.categories };
  const formats = { ...state.weights.formats };
  if (insight.target.type === "category") {
    categories[insight.target.value as Category] = clamp01(
      categories[insight.target.value as Category] + insight.delta
    );
  } else {
    formats[insight.target.value as Format] = clamp01(
      formats[insight.target.value as Format] + insight.delta
    );
  }
  const norm = normalize({ categories, formats });
  const queue = sortedQueue(state.queue, norm, profile, state.seen, state.history);
  return {
    ...state,
    weights: norm,
    queue,
    appliedInsights: new Set(Array.from(state.appliedInsights).concat(insight.id)),
  };
}

// ---------------------------------------------------------------------------
// Voice intent — the conversational coach's channel into the engine. A spoken
// transcript is parsed into a VoiceReading, which nudges real category/format
// weights; the queue then re-ranks through the same cognitive + DPP scoring as
// a swipe. Nothing here is mocked — the Taste Profile bars move because the
// weights genuinely changed.
// ---------------------------------------------------------------------------

const VOICE_CATEGORY_BOOST = 16;
const VOICE_FORMAT_BOOST = 14;

export function applyVoiceIntent(
  state: EngineState,
  transcript: string,
  profile: UserProfile
): { state: EngineState; reading: VoiceReading } {
  const reading = extractIntent(transcript, profile);

  const categories = { ...state.weights.categories };
  const formats = { ...state.weights.formats };

  for (const cat of reading.categories) {
    categories[cat] = clamp01(categories[cat] + VOICE_CATEGORY_BOOST);
  }

  // Mode reshapes the format mix. Restore pulls decisively away from heavy
  // project work toward lighter video/bite; execute does the reverse (they
  // have the input, they need output); focus leans into depth.
  switch (reading.mode) {
    case "restore":
      formats.bite = clamp01(formats.bite + 18);
      formats.video = clamp01(formats.video + 16);
      formats.project = clamp01(formats.project - 24);
      break;
    case "execute":
      formats.project = clamp01(formats.project + 22);
      formats.video = clamp01(formats.video - 14);
      formats.bite = clamp01(formats.bite - 6);
      break;
    case "focus":
      formats.project = clamp01(formats.project + VOICE_FORMAT_BOOST);
      formats.read = clamp01(formats.read + 8);
      break;
    case "neutral":
      break;
  }
  if (reading.formatFocus) {
    formats[reading.formatFocus] = clamp01(formats[reading.formatFocus] + VOICE_FORMAT_BOOST);
  }

  const norm = normalize({ categories, formats });
  const queue = sortedQueue(state.queue, norm, profile, state.seen, state.history);

  return {
    state: { ...state, weights: norm, queue, lastReading: reading },
    reading,
  };
}

// ---------------------------------------------------------------------------
// Normalization — map raw weights to 0–100% for the taste bars.
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function normalize(weights: Weights): Weights {
  const catVals = Object.values(weights.categories);
  const fmtVals = Object.values(weights.formats);
  const maxCat = Math.max(...catVals, 1);
  const maxFmt = Math.max(...fmtVals, 1);
  const categories = {} as Record<Category, number>;
  for (const c of ALL_CATEGORIES) {
    categories[c] = Math.round((weights.categories[c] / maxCat) * 100);
  }
  const formats = {} as Record<Format, number>;
  for (const f of ALL_FORMATS) {
    formats[f] = Math.round((weights.formats[f] / maxFmt) * 100);
  }
  return { categories, formats };
}

// Builds the "Why this?" blurb from live weights instead of a per-card string.

export function whyThis(
  card: Recommendation,
  state: EngineState,
  profile: UserProfile
): string {
  const catW = state.weights.categories[card.category];
  const fmtW = state.weights.formats[card.format];
  const parts: string[] = [];

  if (catW >= 70) {
    parts.push(`${card.category} is currently a top interest in your profile`);
  } else if (profile.interests.includes(card.category)) {
    parts.push(`you selected ${card.category} during onboarding`);
  } else {
    parts.push(`${card.category} is rising in your taste profile`);
  }

  if (fmtW >= 70) {
    parts.push(`you consistently choose ${FORMAT_LABELS[card.format].toLowerCase()} content`);
  } else if (card.format === profile.learningStyle) {
    parts.push(`it matches your preferred ${FORMAT_LABELS[card.format].toLowerCase()} style`);
  }

  if (card.duration <= profile.dailyTime) {
    parts.push(`it fits your ${profile.dailyTime}-minute daily window`);
  }

  if (parts.length === 1) return `Because ${parts[0]}.`;
  if (parts.length === 2) return `Because ${parts[0]} and ${parts[1]}.`;
  return `Because ${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}.`;
}

// The little line of copy under the card.

export function trajectory(state: EngineState, profile: UserProfile): string {
  const n = state.accepted.length;
  if (n === 0) {
    return `Your path toward ${profile.aspiration} starts with your first accepted quest.`;
  }
  if (n === 1) {
    return `You're beginning to build toward ${profile.aspiration} — 1 quest accepted.`;
  }
  return `You're building toward ${profile.aspiration} — ${n} accepted quests point here.`;
}

// Insights only fire once a pattern crosses a threshold, and each one carries
// the actual accept/skip counts that triggered it.

const INSIGHT_THRESHOLDS = {
  consistency: 3,
  contradiction: 3,
  emergence: 3,
};

export function detectInsight(state: EngineState, profile: UserProfile): Insight | null {
  // Friction comes FIRST. If the user is stalling on hard content inside a goal
  // they chose, the honest reading is fatigue, not a change of heart — and the
  // fix is a lighter on-ramp in the same topic. Surfacing this before the
  // "contradiction" check is what stops the app from ever suggesting a topic
  // switch when the real problem is difficulty.
  const friction = detectFriction(state.history, profile, LIVE_CORPUS);
  if (friction.active) {
    for (const topic of friction.topics) {
      const id = `friction-${topic}`;
      if (state.dismissedInsights.has(id) || state.appliedInsights.has(id)) continue;
      const run = friction.runByTopic[topic] ?? FRICTION_THRESHOLD;
      return {
        id,
        kind: "friction",
        headline: `${topic} isn't losing you — the difficulty is`,
        body: `You've passed on ${run} demanding ${topic} quests in a row. That reads as friction, not a change of direction, so I'm keeping the goal and lowering the effort: shorter, lighter ${topic} content first. I can bias your queue that way now.`,
        receipts: frictionReceipts(state, topic, run),
        // Target the LIGHTEST format, never the topic. The goal is preserved by
        // construction — there is no category delta here to move it.
        target: { type: "format", value: "bite" },
        delta: 16,
      };
    }
  }

  // Consistency: a format reaches >=3 accepts and dominates other formats.
  const fmtAccepts = ALL_FORMATS.map((f) => ({
    f,
    n: state.counters.formats[f].accept,
  })).sort((a, b) => b.n - a.n);
  const topFmt = fmtAccepts[0];
  const secondFmt = fmtAccepts[1];
  if (
    topFmt.n >= INSIGHT_THRESHOLDS.consistency &&
    topFmt.n > secondFmt.n &&
    !state.dismissedInsights.has(`consistency-${topFmt.f}`) &&
    !state.appliedInsights.has(`consistency-${topFmt.f}`)
  ) {
    return {
      id: `consistency-${topFmt.f}`,
      kind: "consistency",
      headline: `You consistently choose ${FORMAT_LABELS[topFmt.f].toLowerCase()} over others`,
      body: `Your recent choices lean strongly toward ${FORMAT_LABELS[topFmt.f].toLowerCase()} learning. I can tune your recommendations to favor this format.`,
      receipts: formatReceipts(state, { type: "format", value: topFmt.f }),
      target: { type: "format", value: topFmt.f },
      delta: 18,
    };
  }

  // Contradiction: an onboarding interest is skipped >=3 and skipped > accepted.
  //
  // HARD RULE GUARD: this insight proposes moving weight AWAY from a stated goal
  // and toward a different topic. That is only legitimate when the skips are
  // genuine disinterest. If the skips in this category were mostly hard
  // ("stretch") items, the user is experiencing friction and the friction
  // insight above owns the response — we must not suggest switching topics.
  for (const cat of profile.interests) {
    const c = state.counters.categories[cat];
    if (
      c.skip >= INSIGHT_THRESHOLDS.contradiction &&
      c.skip > c.accept &&
      !isFrictionDrivenCategory(state, profile, cat) &&
      !state.dismissedInsights.has(`contradiction-${cat}`) &&
      !state.appliedInsights.has(`contradiction-${cat}`)
    ) {
      const rising = findRisingCategory(state, profile.interests);
      return {
        id: `contradiction-${cat}`,
        kind: "contradiction",
        headline: `It appears your interests may be evolving${rising ? ` toward ${rising}` : ""}`,
        body: `You've been skipping ${cat} content despite selecting it at the start. ${rising ? `Meanwhile ${rising} is gaining traction.` : "Your taste profile may be shifting."} I can re-weight accordingly.`,
        receipts: formatReceipts(state, { type: "category", value: cat }),
        target: { type: "category", value: cat },
        delta: -20,
      };
    }
  }

  // Emergence: a non-onboarding category crosses accept threshold.
  for (const cat of ALL_CATEGORIES) {
    if (profile.interests.includes(cat)) continue;
    const c = state.counters.categories[cat];
    if (
      c.accept >= INSIGHT_THRESHOLDS.emergence &&
      !state.dismissedInsights.has(`emergence-${cat}`) &&
      !state.appliedInsights.has(`emergence-${cat}`)
    ) {
      return {
        id: `emergence-${cat}`,
        kind: "emergence",
        headline: `A new interest is forming: ${cat}`,
        body: `You've accepted several ${cat} quests that weren't part of your initial interests. I can elevate ${cat} in your recommendations.`,
        receipts: formatReceipts(state, { type: "category", value: cat }),
        target: { type: "category", value: cat },
        delta: 22,
      };
    }
  }

  return null;
}

/**
 * Were this category's skips mostly HARD content? If so the user is hitting
 * friction, not losing interest, and any insight that would move weight away
 * from the topic must stand down. Majority rule over skipped items in-topic.
 */
function isFrictionDrivenCategory(
  state: EngineState,
  profile: UserProfile,
  cat: Category
): boolean {
  let skipped = 0;
  let stretchSkipped = 0;
  const byId = new Map(LIVE_CORPUS.map((c) => [c.id, c]));
  for (const it of state.history) {
    if (it.category !== cat || it.direction !== "skip") continue;
    skipped++;
    const card = byId.get(it.recommendationId);
    if (card && contentTier(card, profile) === "stretch") stretchSkipped++;
  }
  if (skipped === 0) return false;
  return stretchSkipped * 2 >= skipped; // at least half were stretch items
}

/** Receipts for the friction insight — real counts from the session. */
function frictionReceipts(state: EngineState, cat: Category, run: number): string {
  const c = state.counters.categories[cat];
  return `${cat}: ${run} hard quests skipped in a row · ${c.accept} accepted · ${c.skip} skipped · ${c.later} saved · goal unchanged`;
}

function findRisingCategory(state: EngineState, exclude: Category[]): Category | null {
  let best: Category | null = null;
  let bestScore = -Infinity;
  for (const cat of ALL_CATEGORIES) {
    if (exclude.includes(cat)) continue;
    const c = state.counters.categories[cat];
    const score = c.accept * 2 - c.skip;
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return best;
}

function formatReceipts(
  state: EngineState,
  focus: { type: "format" | "category"; value: string }
): string {
  const lines: string[] = [];
  if (focus.type === "category") {
    const focusCat = focus.value as Category;
    const fc = state.counters.categories[focusCat];
    lines.push(`${capitalize(focusCat)}: ${fc.accept} accepted · ${fc.skip} skipped · ${fc.later} saved`);
    // Show a couple other notable categories.
    const others = ALL_CATEGORIES.filter((c) => c !== focusCat).map((c) => {
      const cc = state.counters.categories[c];
      return { c, total: cc.accept + cc.skip + cc.later, cc };
    }).filter((o) => o.total > 0).sort((a, b) => b.total - a.total).slice(0, 2);
    for (const o of others) {
      lines.push(`${o.c}: ${o.cc.accept} accepted · ${o.cc.skip} skipped · ${o.cc.later} saved`);
    }
  } else {
    const fmt = focus.value as Format;
    const fc = state.counters.formats[fmt];
    lines.push(`${FORMAT_LABELS[fmt]}: ${fc.accept} accepted · ${fc.skip} skipped · ${fc.later} saved`);
    const others = ALL_FORMATS.filter((f) => f !== fmt).map((f) => {
      const cc = state.counters.formats[f];
      return { f, total: cc.accept + cc.skip + cc.later, cc };
    }).filter((o) => o.total > 0).sort((a, b) => b.total - a.total);
    for (const o of others) {
      lines.push(`${FORMAT_LABELS[o.f]}: ${o.cc.accept} accepted · ${o.cc.skip} skipped · ${o.cc.later} saved`);
    }
  }
  return lines.join(" · ");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// The 4 bars we actually show in the Taste Profile rail.

export function topWeights(state: EngineState, profile: UserProfile): { label: string; value: number; accent: string }[] {
  const all: { label: string; value: number; accent: string }[] = [];
  for (const c of ALL_CATEGORIES) {
    all.push({
      label: c,
      value: state.weights.categories[c],
      accent: CATEGORY_ACCENTS[c],
    });
  }
  for (const f of ALL_FORMATS) {
    all.push({
      label: FORMAT_LABELS[f],
      value: state.weights.formats[f],
      accent: "hsl(0, 0%, 40%)",
    });
  }
  // Prioritize onboarding interests and high-value items, then sort by value.
  all.sort((a, b) => {
    const aIsInterest = profile.interests.includes(a.label as Category) ? 1 : 0;
    const bIsInterest = profile.interests.includes(b.label as Category) ? 1 : 0;
    if (aIsInterest !== bIsInterest) return bIsInterest - aIsInterest;
    return b.value - a.value;
  });
  return all.slice(0, 4);
}

// These two are async on purpose so swapping in Supabase/Groq later is a
// drop-in change. For now they just return local data.

// TODO: pull from a Supabase `recommendations` table instead of the local list.
export async function fetchRecommendations(): Promise<Recommendation[]> {
  return LIVE_CORPUS;
}

// TODO: hit Groq (llama-3.3-70b) to write a real explanation grounded in the
// user's session. Returning the templated string for now.
export async function getGroqExplanation(
  card: Recommendation,
  state: EngineState,
  profile: UserProfile
): Promise<string> {
  return whyThis(card, state, profile);
}
