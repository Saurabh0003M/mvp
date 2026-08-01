// All the recommendation logic lives here. Keeping it in one file means we can
// swap the local corpus for Supabase and the templated "why" strings for a real
// LLM later without the UI needing to change.

// Types. These roughly mirror the tables we'll want in the DB eventually.

export type Category =
  | "AI/ML"
  | "Cybersecurity"
  | "Web Dev"
  | "Basketball"
  | "Design"
  | "Business"
  | "Data Science"
  | "Creative Writing";

export type Format = "project" | "read" | "video" | "bite";
export type Difficulty = "Beginner" | "Intermediate" | "Advanced";
export type LearningStyle = "project" | "read" | "video" | "bite";

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: Category;
  format: Format;
  difficulty: Difficulty;
  duration: number; // minutes
  tags: string[];
}

export interface UserProfile {
  aspiration: string;
  interests: Category[];
  experience: Difficulty;
  learningStyle: LearningStyle;
  dailyTime: 15 | 30 | 60;
}

export type SwipeDirection = "accept" | "skip" | "later";

export interface Interaction {
  recommendationId: string;
  category: Category;
  format: Format;
  direction: SwipeDirection;
  timestamp: number;
}

export interface Weights {
  categories: Record<Category, number>;
  formats: Record<Format, number>;
}

export interface Counters {
  categories: Record<Category, { accept: number; skip: number; later: number }>;
  formats: Record<Format, { accept: number; skip: number; later: number }>;
}

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
}

export interface Insight {
  id: string;
  kind: "consistency" | "contradiction" | "emergence";
  headline: string;
  body: string;
  receipts: string;
  target?: { type: "format" | "category"; value: string };
  delta?: number;
}

export const ALL_CATEGORIES: Category[] = [
  "AI/ML",
  "Cybersecurity",
  "Web Dev",
  "Basketball",
  "Design",
  "Business",
  "Data Science",
  "Creative Writing",
];

export const ALL_FORMATS: Format[] = ["project", "read", "video", "bite"];

export const FORMAT_LABELS: Record<Format, string> = {
  project: "Project-based",
  read: "Reading",
  video: "Video",
  bite: "Bite-sized",
};

export const CATEGORY_ACCENTS: Record<Category, string> = {
  "AI/ML": "hsl(168, 70%, 42%)",
  Cybersecurity: "hsl(200, 70%, 52%)",
  "Web Dev": "hsl(262, 60%, 60%)",
  Basketball: "hsl(28, 80%, 56%)",
  Design: "hsl(330, 70%, 58%)",
  Business: "hsl(142, 60%, 46%)",
  "Data Science": "hsl(190, 65%, 48%)",
  "Creative Writing": "hsl(0, 70%, 56%)",
};

// Starter corpus, ~28 items. Hardcoded for now until we have a real DB.

export const RECOMMENDATIONS: Recommendation[] = [
  // AI/ML
  { id: "ai-1", title: "Build a RAG Chatbot with LangChain", description: "Construct a retrieval-augmented generation pipeline over your own documents and ship a working chatbot.", category: "AI/ML", format: "project", difficulty: "Intermediate", duration: 60, tags: ["llm", "rag", "python"] },
  { id: "ai-2", title: "Train a Small Transformer from Scratch", description: "Implement a minimal transformer in PyTorch and train it on a toy dataset to demystify attention.", category: "AI/ML", format: "project", difficulty: "Advanced", duration: 60, tags: ["transformer", "pytorch"] },
  { id: "ai-3", title: "Read: Attention Is All You Need", description: "The landmark paper that introduced the transformer. Annotated guides make it approachable.", category: "AI/ML", format: "read", difficulty: "Advanced", duration: 30, tags: ["paper", "transformer"] },
  { id: "ai-4", title: "Watch: How GPT Models Work in 15 Min", description: "A crisp visual explainer on tokenization, embeddings, and next-token prediction.", category: "AI/ML", format: "video", difficulty: "Beginner", duration: 15, tags: ["gpt", "explainer"] },
  { id: "ai-5", title: "Fine-tune an Open-Source LLM", description: "Take a small open model and fine-tune it on a custom dataset using LoRA.", category: "AI/ML", format: "project", difficulty: "Advanced", duration: 60, tags: ["fine-tuning", "lora"] },

  // Cybersecurity
  { id: "sec-1", title: "Capture the Flag: Web Exploitation 101", description: "Solve a guided set of web vulnerability challenges on a legal CTF platform.", category: "Cybersecurity", format: "project", difficulty: "Beginner", duration: 30, tags: ["ctf", "web", "owasp"] },
  { id: "sec-2", title: "Read: The TAO of Network Security", description: "A practical primer on packet inspection, firewalls, and zero-trust architecture.", category: "Cybersecurity", format: "read", difficulty: "Intermediate", duration: 30, tags: ["network", "zero-trust"] },
  { id: "sec-3", title: "Set Up a Home Lab with Suricata IDS", description: "Spin up an intrusion-detection system and analyze real traffic captures.", category: "Cybersecurity", format: "project", difficulty: "Advanced", duration: 60, tags: ["ids", "suricata", "lab"] },
  { id: "sec-4", title: "Watch: How Buffer Overflows Actually Work", description: "A visual walkthrough of stack memory and a classic exploitation primitive.", category: "Cybersecurity", format: "video", difficulty: "Intermediate", duration: 15, tags: ["binary", "exploitation"] },
  { id: "sec-5", title: "Threat Modeling in 15 Minutes", description: "Learn the STRIDE framework and threat-model a small app you already use.", category: "Cybersecurity", format: "bite", difficulty: "Beginner", duration: 15, tags: ["stride", "modeling"] },

  // Web Dev
  { id: "web-1", title: "Build a Realtime Synced Todo App", description: "Use CRDTs or WebSockets to build a multi-user todo list with live updates.", category: "Web Dev", format: "project", difficulty: "Intermediate", duration: 60, tags: ["realtime", "websockets"] },
  { id: "web-2", title: "Read: Rendering Patterns on the Modern Web", description: "A deep dive on SSR, SSG, ISR, and streaming — when to reach for each.", category: "Web Dev", format: "read", difficulty: "Intermediate", duration: 30, tags: ["ssr", "rendering"] },
  { id: "web-3", title: "Ship a Full-Stack App with Server Actions", description: "Build a small CRUD app using a modern framework's server actions and forms.", category: "Web Dev", format: "project", difficulty: "Intermediate", duration: 60, tags: ["fullstack", "server-actions"] },
  { id: "web-4", title: "Watch: CSS Container Queries in 12 Min", description: "A focused tour of container queries and where they beat media queries.", category: "Web Dev", format: "video", difficulty: "Beginner", duration: 15, tags: ["css", "responsive"] },

  // Basketball
  { id: "bball-1", title: "Footwork Series: The Jab Step", description: "A 15-minute drill progression to make your jab step a real threat.", category: "Basketball", format: "video", difficulty: "Beginner", duration: 15, tags: ["footwork", "scoring"] },
  { id: "bball-2", title: "Read: The Physics of the Jump Shot", description: "Understand arc, release angle, and backspin to diagnose your own shot.", category: "Basketball", format: "read", difficulty: "Intermediate", duration: 15, tags: ["shooting", "mechanics"] },
  { id: "bball-3", title: "30-Minute Scoring Workout", description: "A structured solo workout: form shooting, pull-ups, and finishing at the rim.", category: "Basketball", format: "project", difficulty: "Intermediate", duration: 30, tags: ["workout", "scoring"] },
  { id: "bball-4", title: "Watch: How to Read a Pick & Roll", description: "A film breakdown of guard-big interactions and defensive counters.", category: "Basketball", format: "video", difficulty: "Advanced", duration: 15, tags: ["film", "bball-iq"] },

  // Design
  { id: "design-1", title: "Redesign a Screen You Hate", description: "Pick one frustrating app screen and redesign it with a clear rationale.", category: "Design", format: "project", difficulty: "Intermediate", duration: 30, tags: ["ui", "redesign"] },
  { id: "design-2", title: "Read: Refactoring UI, Ch. 1–2", description: "The foundational chapters on hierarchy, spacing, and visual design as engineering.", category: "Design", format: "read", difficulty: "Beginner", duration: 30, tags: ["visual-design", "hierarchy"] },
  { id: "design-3", title: "Watch: The Principles of Animation", description: "A concise explainer on easing, timing, and choreography for interface motion.", category: "Design", format: "video", difficulty: "Beginner", duration: 15, tags: ["motion", "animation"] },
  { id: "design-4", title: "Build a Tiny Design System", description: "Define tokens, primitives, and a few components for a fictional product.", category: "Design", format: "project", difficulty: "Advanced", duration: 60, tags: ["design-system", "tokens"] },

  // Business
  { id: "biz-1", title: "Read: The Mom Test, Ch. 1–3", description: "Learn to run customer interviews that surface truth instead of flattery.", category: "Business", format: "read", difficulty: "Beginner", duration: 15, tags: ["customer-dev", "interviews"] },
  { id: "biz-2", title: "Write a One-Page Lean Canvas", description: "Sketch the business model for an idea you have in a single structured page.", category: "Business", format: "project", difficulty: "Beginner", duration: 30, tags: ["lean", "model"] },
  { id: "biz-3", title: "Watch: Pricing Strategy Fundamentals", description: "A primer on value-based vs cost-plus pricing and how to choose.", category: "Business", format: "video", difficulty: "Intermediate", duration: 15, tags: ["pricing", "strategy"] },
  { id: "biz-4", title: "Read: Good Strategy / Bad Strategy, Intro", description: "The kernel of strategy: diagnosis, guiding policy, and coherent action.", category: "Business", format: "read", difficulty: "Intermediate", duration: 30, tags: ["strategy"] },

  // Data Science
  { id: "ds-1", title: "Analyze a Kaggle Dataset End-to-End", description: "Pick a dataset, clean it, explore it, and tell a story with one chart.", category: "Data Science", format: "project", difficulty: "Intermediate", duration: 60, tags: ["eda", "pandas"] },
  { id: "ds-2", title: "Read: Tidy Data by Hadley Wickham", description: "The canonical paper on structuring datasets for analysis.", category: "Data Science", format: "read", difficulty: "Intermediate", duration: 30, tags: ["tidy-data", "paper"] },
  { id: "ds-3", title: "Watch: SQL Window Functions in 15 Min", description: "Master the most powerful SQL feature with clear examples.", category: "Data Science", format: "video", difficulty: "Intermediate", duration: 15, tags: ["sql", "window-functions"] },

  // Creative Writing
  { id: "cw-1", title: "Write a 500-Word Flash Fiction", description: "A constrained daily prompt to build narrative instinct under pressure.", category: "Creative Writing", format: "project", difficulty: "Beginner", duration: 15, tags: ["fiction", "prompt"] },
  { id: "cw-2", title: "Read: On Writing, Ch. Toolbox", description: "Stephen King's practical toolkit on vocabulary, grammar, and dialogue.", category: "Creative Writing", format: "read", difficulty: "Beginner", duration: 30, tags: ["craft", "toolkit"] },
  { id: "cw-3", title: "Watch: The Shape of a Good Sentence", description: "A short study of rhythm, cadence, and sentence-level revision.", category: "Creative Writing", format: "video", difficulty: "Intermediate", duration: 15, tags: ["style", "revision"] },
];

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
  const queue = sortedQueue(RECOMMENDATIONS.slice(), weights, profile, seen);
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
  seen: Set<string>
): number {
  const cat = weights.categories[card.category] ?? 0;
  const fmt = weights.formats[card.format] ?? 0;
  const repetition = seen.has(card.id) ? 25 : 0;
  return cat * 0.6 + fmt * 0.4 - repetition;
}

function sortedQueue(
  cards: Recommendation[],
  weights: Weights,
  profile: UserProfile,
  seen: Set<string>
): Recommendation[] {
  return cards
    .map((c) => ({ card: c, score: scoreCard(c, weights, seen) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.card);
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
  categories[card.category] = clamp01(categories[card.category] + mag * LEARN);
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

  const queue = sortedQueue(remaining, norm, profile, seen);

  return {
    ...state,
    weights: norm,
    counters,
    queue,
    accepted,
    later,
    history: [...state.history, interaction],
    seen,
  };
}

export function reSurface(state: EngineState, cardId: string, profile: UserProfile): EngineState {
  const card = state.later.find((c) => c.id === cardId);
  if (!card) return state;
  return {
    ...state,
    later: state.later.filter((c) => c.id !== cardId),
    queue: sortedQueue([card, ...state.queue], state.weights, profile, state.seen),
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
  const queue = sortedQueue(state.queue, norm, profile, state.seen);
  return {
    ...state,
    weights: norm,
    queue,
    appliedInsights: new Set(Array.from(state.appliedInsights).concat(insight.id)),
  };
}

// Rescale raw weights to 0-100 so the taste bars have something clean to show.

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
  for (const cat of profile.interests) {
    const c = state.counters.categories[cat];
    if (
      c.skip >= INSIGHT_THRESHOLDS.contradiction &&
      c.skip > c.accept &&
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
  return RECOMMENDATIONS;
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
