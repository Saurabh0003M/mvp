// ============================================================================
// Eudaimonic cognitive layer — Ryff wellbeing estimation + Compressed
// Cognitive State (CCS)
// ----------------------------------------------------------------------------
// Two ideas, both load-bearing.
//
// 1. WELLBEING SPACE, NOT TASTE SPACE. A taste profile answers "what will you
//    click?". Ryff's six dimensions of psychological well-being answer "what
//    is actually growing?" — Autonomy, Environmental Mastery, Personal
//    Growth, Positive Relations, Purpose in Life, Self-Acceptance. We
//    estimate all six from observed choices, never from a questionnaire.
//
// 2. BOUNDED STATE, NOT A TRANSCRIPT. Replaying an ever-growing interaction
//    log into a model invites drift and lets early noise poison later turns.
//    Instead we keep a Compressed Cognitive State: a small, fixed-shape
//    object rebuilt from scratch every turn (full replacement, never
//    appended). Its size is O(1) in turns — turn 500 costs what turn 5 did.
//
// Every number here is derived arithmetic over real session events; nothing is
// fabricated. One honest caveat: Ryff's Scales of Psychological Well-Being are
// a research questionnaire, not a diagnostic, and this is a *behavioural
// proxy* for them. Surface it as an estimate with a confidence, never as a
// clinical score.
// ============================================================================

import {
  ALL_CATEGORIES,
  ALL_FORMATS,
  FORMAT_LABELS,
  type Category,
  type Difficulty,
  type Format,
  type Interaction,
  type Recommendation,
  type UserProfile,
} from "./taxonomy";

// ---------------------------------------------------------------------------
// The six axes
// ---------------------------------------------------------------------------

export type RyffAxis =
  | "autonomy"
  | "environmentalMastery"
  | "personalGrowth"
  | "positiveRelations"
  | "purposeInLife"
  | "selfAcceptance";

export type RyffVector = Record<RyffAxis, number>;

export const AXIS_ORDER: RyffAxis[] = [
  "autonomy",
  "environmentalMastery",
  "personalGrowth",
  "positiveRelations",
  "purposeInLife",
  "selfAcceptance",
];

export const AXIS_LABELS: Record<RyffAxis, string> = {
  autonomy: "Autonomy",
  environmentalMastery: "Environmental Mastery",
  personalGrowth: "Personal Growth",
  positiveRelations: "Positive Relations",
  purposeInLife: "Purpose in Life",
  selfAcceptance: "Self-Acceptance",
};

/** Plain-language meaning, shown in the UI so the axes aren't jargon. */
export const AXIS_BLURB: Record<RyffAxis, string> = {
  autonomy: "Choosing for yourself, not from the script you were handed.",
  environmentalMastery: "Acting on the world, not just reading about it.",
  personalGrowth: "Stretching past what you already know.",
  positiveRelations: "Learning that involves other people.",
  purposeInLife: "Work that points at who you're becoming.",
  selfAcceptance: "Meeting your own gaps without flinching.",
};

export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

/**
 * Strength of the neutral prior, in units of "opportunity mass". With k = 4,
 * a single accepted card can't swing an axis to 10 — the estimate stays near
 * the midpoint until there's real evidence. This is what keeps early-session
 * numbers honest instead of theatrical.
 */
const PRIOR_STRENGTH = 4;
const PRIOR_RATIO = 0.5;

// ---------------------------------------------------------------------------
// Content → axis mapping
// ---------------------------------------------------------------------------

/** Tags that imply another human is in the loop. */
const RELATIONAL_TAGS = new Set([
  "interviews",
  "customer-dev",
  "film",
  "team",
  "dialogue",
  "audience",
  "story",
  "bball-iq",
]);

/** Tags that imply reflection on one's own work rather than new intake. */
const REFLECTIVE_TAGS = new Set([
  "revision",
  "redesign",
  "mechanics",
  "modeling",
  "strategy",
  "craft",
]);

const DIFFICULTY_RANK: Record<Difficulty, number> = {
  Beginner: 0,
  Intermediate: 1,
  Advanced: 2,
};

function zeroVector(): RyffVector {
  return {
    autonomy: 0,
    environmentalMastery: 0,
    personalGrowth: 0,
    positiveRelations: 0,
    purposeInLife: 0,
    selfAcceptance: 0,
  };
}

/**
 * How much a single item can serve each wellbeing axis, in 0..1.
 *
 * This is the one deliberately opinionated table in the system, and it is
 * worth being explicit about why each edge exists:
 *
 *  - `project` work is the only format that produces an artifact, so it
 *    dominates Environmental Mastery. Reading *about* mastery is not mastery.
 *  - Difficulty above the user's stated level feeds Personal Growth; content
 *    *below* their level feeds Self-Acceptance, because choosing to revisit
 *    fundamentals when you've labelled yourself "Advanced" is an ego-free act.
 *  - Purpose is not intrinsic to an item — it depends on whether the item
 *    points at *this* user's stated aspiration. Hence `profile` is required.
 *  - Positive Relations is the weakest axis in this corpus: solo learning
 *    material rarely involves other people. We let it read low rather than
 *    inventing signal, and the UI says so.
 */
export function contentAxes(
  card: Recommendation,
  profile: UserProfile
): RyffVector {
  const v = zeroVector();

  // --- Format: what kind of act is this? ---
  switch (card.format) {
    case "project":
      v.environmentalMastery += 0.9;
      v.personalGrowth += 0.55;
      break;
    case "read":
      v.personalGrowth += 0.75;
      v.purposeInLife += 0.25;
      break;
    case "video":
      v.personalGrowth += 0.45;
      break;
    case "bite":
      v.personalGrowth += 0.3;
      v.environmentalMastery += 0.35;
      break;
  }

  // --- Difficulty relative to the user, not in absolute terms ---
  const gap = DIFFICULTY_RANK[card.difficulty] - DIFFICULTY_RANK[profile.experience];
  if (gap > 0) {
    v.personalGrowth += 0.3 * gap; // stretch
  } else if (gap < 0) {
    v.selfAcceptance += 0.45 * Math.abs(gap); // revisiting fundamentals
  } else {
    v.selfAcceptance += 0.15; // working at your honest level
  }

  // --- Purpose: does this point at the aspiration they named? ---
  if (matchesAspiration(card, profile.aspiration)) {
    v.purposeInLife += 0.8;
  }

  // --- Autonomy: chosen outside the box they ticked at onboarding ---
  if (!profile.interests.includes(card.category)) {
    v.autonomy += 0.7;
  } else {
    v.autonomy += 0.15;
  }

  // --- Tags ---
  for (const tag of card.tags) {
    if (RELATIONAL_TAGS.has(tag)) v.positiveRelations += 0.6;
    if (REFLECTIVE_TAGS.has(tag)) v.selfAcceptance += 0.2;
  }

  // --- Fits the time they said they had: mastery of their own environment ---
  if (card.duration <= profile.dailyTime) {
    v.environmentalMastery += 0.2;
  }

  for (const axis of AXIS_ORDER) {
    v[axis] = Math.min(1, round2(v[axis]));
  }
  return v;
}

/**
 * Keyword overlap between the free-text aspiration and the item. Deliberately
 * simple and case-insensitive: category words, tags, and title tokens. A real
 * deployment would use embeddings; this is transparent and needs no network.
 */
function matchesAspiration(card: Recommendation, aspiration: string): boolean {
  const asp = aspiration.toLowerCase();
  if (!asp.trim()) return false;

  const haystack = [
    card.category.toLowerCase(),
    ...card.tags.map((t) => t.toLowerCase()),
    card.title.toLowerCase(),
  ].join(" ");

  // Direct category mention, e.g. "AI Engineer" ↔ "AI/ML".
  const catTokens = card.category.toLowerCase().split(/[^a-z]+/).filter((t) => t.length > 1);
  for (const t of catTokens) {
    if (asp.includes(t)) return true;
  }

  // Aspiration words appearing in the item's own vocabulary.
  const aspTokens = asp.split(/[^a-z]+/).filter((t) => t.length > 3);
  for (const t of aspTokens) {
    if (STOP_WORDS.has(t)) continue;
    if (haystack.includes(t)) return true;
  }
  return false;
}

const STOP_WORDS = new Set(["want", "become", "learn", "good", "great", "better", "someone", "person"]);

// ---------------------------------------------------------------------------
// Estimation
// ---------------------------------------------------------------------------

export interface RyffEstimate {
  /** 1–10 per axis. */
  scores: RyffVector;
  /** 0–1 per axis: how much evidence backs the score. */
  confidence: RyffVector;
  /** Total items considered. */
  sampleSize: number;
}

/**
 * Estimate the six axes from what the user actually did.
 *
 * For each axis: `earned` is the axis-mass of items they accepted, `offered`
 * is the axis-mass of everything they were shown and judged. The ratio is
 * shrunk toward the neutral midpoint in proportion to how little evidence
 * exists, so the numbers start honest and sharpen with use.
 */
export function estimateRyff(
  history: Interaction[],
  profile: UserProfile,
  corpus: Recommendation[]
): RyffEstimate {
  const byId = new Map(corpus.map((c) => [c.id, c]));
  const earned = zeroVector();
  const offered = zeroVector();
  let sampleSize = 0;

  for (const it of history) {
    const card = byId.get(it.recommendationId);
    if (!card) continue;
    sampleSize++;
    const axes = contentAxes(card, profile);
    for (const axis of AXIS_ORDER) {
      offered[axis] += axes[axis];
      if (it.direction === "accept") {
        earned[axis] += axes[axis];
      } else if (it.direction === "later") {
        // Saving something is a weak positive: intent without action.
        earned[axis] += axes[axis] * 0.25;
      }
    }
  }

  const scores = zeroVector();
  const confidence = zeroVector();

  for (const axis of AXIS_ORDER) {
    const n = offered[axis];
    const ratio = n > 0 ? earned[axis] / n : PRIOR_RATIO;
    const shrunk = (ratio * n + PRIOR_RATIO * PRIOR_STRENGTH) / (n + PRIOR_STRENGTH);
    scores[axis] = clampScore(SCORE_MIN + shrunk * (SCORE_MAX - SCORE_MIN));
    confidence[axis] = round2(n / (n + PRIOR_STRENGTH));
  }

  return { scores, confidence, sampleSize };
}

// ---------------------------------------------------------------------------
// Compressed Cognitive State
// ---------------------------------------------------------------------------

export type Pivot = "none" | "self-compassion" | "execution" | "exploration" | "purpose";

export interface RevealedCategory {
  category: Category;
  accept: number;
  skip: number;
}

/**
 * The bounded state object. Fixed shape, capped arrays, no transcript. This is
 * the *entire* memory handed to the language model — replaced wholesale on
 * every turn, never appended to. Serialized it runs a few hundred tokens
 * regardless of session length.
 */
export interface CompressedCognitiveState {
  version: 1;
  turn: number;
  aspiration: string;

  wellbeing: RyffVector;
  confidence: RyffVector;
  strongestAxis: RyffAxis;
  weakestAxis: RyffAxis;

  /** What they said they wanted, at onboarding. */
  stated: { interests: Category[]; format: Format; experience: Difficulty };
  /** What their swipes actually reveal. Capped at 3 entries. */
  revealed: { categories: RevealedCategory[]; format: Format | null };
  /** 0–1: how far revealed behaviour has drifted from stated intent. */
  divergence: number;

  /** Consecutive passive-consumption accepts with no project among them. */
  consumptionRun: number;
  /** Accepted items that produce no artifact, minus those that do. */
  executionDebt: number;

  pivot: Pivot;
  updatedAt: number;
}

const MAX_REVEALED = 3;
/** Consecutive passive accepts before Algorithmic Cooling fires. */
export const COOLING_THRESHOLD = 3;

/**
 * Rebuild the CCS from scratch. Pure function of (history, profile, corpus) —
 * deterministic, and immune to the drift you get from incrementally mutating
 * a long-lived memory blob.
 */
export function compressCognitiveState(
  history: Interaction[],
  profile: UserProfile,
  corpus: Recommendation[]
): CompressedCognitiveState {
  const { scores, confidence } = estimateRyff(history, profile, corpus);
  const byId = new Map(corpus.map((c) => [c.id, c]));

  // --- Revealed category preference, ranked by net signal ---
  const catTally = new Map<Category, { accept: number; skip: number }>();
  for (const c of ALL_CATEGORIES) catTally.set(c, { accept: 0, skip: 0 });
  const fmtTally = new Map<Format, number>();
  for (const f of ALL_FORMATS) fmtTally.set(f, 0);

  for (const it of history) {
    const t = catTally.get(it.category);
    if (t) {
      if (it.direction === "accept") t.accept++;
      else if (it.direction === "skip") t.skip++;
    }
    if (it.direction === "accept") {
      fmtTally.set(it.format, (fmtTally.get(it.format) ?? 0) + 1);
    }
  }

  const revealedCategories: RevealedCategory[] = ALL_CATEGORIES.map((category) => ({
    category,
    accept: catTally.get(category)!.accept,
    skip: catTally.get(category)!.skip,
  }))
    .filter((r) => r.accept > 0)
    .sort((a, b) => b.accept - a.accept || a.skip - b.skip)
    .slice(0, MAX_REVEALED);

  let revealedFormat: Format | null = null;
  let bestFmt = 0;
  for (const f of ALL_FORMATS) {
    const n = fmtTally.get(f) ?? 0;
    if (n > bestFmt) {
      bestFmt = n;
      revealedFormat = f;
    }
  }

  // --- Consumption run & execution debt: the "everybody lies" detector ---
  let consumptionRun = 0;
  let executionDebt = 0;
  for (const it of history) {
    if (it.direction !== "accept") {
      consumptionRun = 0;
      continue;
    }
    const card = byId.get(it.recommendationId);
    if (!card) {
      consumptionRun = 0;
      continue;
    }
    if (card.format === "project") {
      consumptionRun = 0;
      executionDebt = Math.max(0, executionDebt - 1);
    } else {
      consumptionRun++;
      executionDebt++;
    }
  }

  const divergence = computeDivergence(history, profile, revealedFormat);

  const ranked = AXIS_ORDER.slice().sort((a, b) => scores[b] - scores[a]);
  const strongestAxis = ranked[0];
  const weakestAxis = ranked[ranked.length - 1];

  return {
    version: 1,
    turn: history.length,
    aspiration: profile.aspiration,
    wellbeing: scores,
    confidence,
    strongestAxis,
    weakestAxis,
    stated: {
      interests: profile.interests.slice(0, 8),
      format: profile.learningStyle,
      experience: profile.experience,
    },
    revealed: { categories: revealedCategories, format: revealedFormat },
    divergence,
    consumptionRun,
    executionDebt,
    pivot: choosePivot(scores, confidence, consumptionRun, divergence),
    updatedAt: Date.now(),
  };
}

/**
 * How far revealed behaviour has drifted from stated intent, 0–1. Two equally
 * weighted components: the share of judged items in stated-interest
 * categories that were skipped, and whether the format they actually accept
 * differs from the one they picked.
 */
function computeDivergence(
  history: Interaction[],
  profile: UserProfile,
  revealedFormat: Format | null
): number {
  let statedSeen = 0;
  let statedSkipped = 0;
  for (const it of history) {
    if (!profile.interests.includes(it.category)) continue;
    statedSeen++;
    if (it.direction === "skip") statedSkipped++;
  }
  const catDrift = statedSeen > 0 ? statedSkipped / statedSeen : 0;
  const fmtDrift = revealedFormat && revealedFormat !== profile.learningStyle ? 1 : 0;
  return round2(Math.min(1, catDrift * 0.6 + fmtDrift * 0.4));
}

/**
 * Pick at most one corrective posture. Order matters — these are checked
 * most-urgent first, and only one is ever active, because an agent that
 * nudges on four axes at once is just noise.
 *
 * The self-compassion rule is the one the research is most specific about:
 * high Personal Growth with low Self-Acceptance is the striver's failure
 * mode — relentless forward motion with no ground to stand on. The correct
 * response is not more challenge.
 */
function choosePivot(
  scores: RyffVector,
  confidence: RyffVector,
  consumptionRun: number,
  divergence: number
): Pivot {
  const known = (a: RyffAxis) => confidence[a] >= 0.4;

  if (
    known("personalGrowth") &&
    known("selfAcceptance") &&
    scores.personalGrowth >= 7 &&
    scores.selfAcceptance <= 4.5
  ) {
    return "self-compassion";
  }
  if (consumptionRun >= COOLING_THRESHOLD) return "execution";
  if (known("purposeInLife") && scores.purposeInLife <= 4) return "purpose";
  if (divergence >= 0.5) return "exploration";
  return "none";
}

// ---------------------------------------------------------------------------
// Scoring hook — how the CCS bends retrieval
// ---------------------------------------------------------------------------

/**
 * Relevance bonus in weight-points (the engine's native 0–100 scale) for an
 * item, given the current cognitive state. Small by design: this *tilts* the
 * ranking toward the neglected axis, it does not seize control of it. The
 * user's revealed taste still leads.
 */
export function eudaimonicBonus(
  card: Recommendation,
  ccs: CompressedCognitiveState,
  profile: UserProfile
): number {
  const axes = contentAxes(card, profile);
  let bonus = 0;

  // Nudge toward the weakest axis — the growth frontier — but scaled by how
  // much evidence actually backs that axis. With an empty history every axis
  // sits at the neutral prior, so "weakest" is just arbitrary tie-breaking;
  // applying a full nudge there would override the user's stated interests and
  // make the very first card look off-target. Confidence starts at 0 and grows,
  // so early recommendations follow stated intent and the wellbeing tilt earns
  // its influence as the session provides real signal.
  bonus += axes[ccs.weakestAxis] * 10 * ccs.confidence[ccs.weakestAxis];

  switch (ccs.pivot) {
    case "self-compassion":
      // Ease off the stretch; favour consolidation and kindness.
      bonus += axes.selfAcceptance * 16;
      bonus -= axes.personalGrowth * 6;
      break;
    case "execution":
      // They have the knowledge. Reward the artifact.
      bonus += card.format === "project" ? 20 : 0;
      bonus -= card.format === "video" ? 8 : 0;
      break;
    case "purpose":
      bonus += axes.purposeInLife * 18;
      break;
    case "exploration":
      bonus += axes.autonomy * 12;
      break;
    case "none":
      break;
  }

  return round2(bonus);
}

// ---------------------------------------------------------------------------
// Narration — used by the UI and as grounding for the LLM
// ---------------------------------------------------------------------------

export const PIVOT_COPY: Record<Pivot, { headline: string; body: string } | null> = {
  none: null,
  "self-compassion": {
    headline: "You're stretching hard. Let's make sure the ground holds.",
    body: "Your choices show strong forward motion but little consolidation. Growth that never rests stops compounding. The next few suggestions ease off the difficulty on purpose.",
  },
  execution: {
    headline: "You have the knowledge. Time to execute in the physical world.",
    body: "Several accepted items in a row were things to read or watch, none to build. That gap is where learning quietly stops converting. I'm surfacing something you can finish and show.",
  },
  purpose: {
    headline: "Plenty of motion. Less of it points where you said you're going.",
    body: "Little of what you've accepted connects to the aspiration you named. That's allowed — but worth noticing while it's still a choice rather than a drift.",
  },
  exploration: {
    headline: "What you pick and what you picked no longer match.",
    body: "You're consistently passing on categories you selected at the start and accepting ones you didn't. I'd rather follow your behaviour than your form.",
  },
};

/**
 * Compact, human-readable rendering of the CCS. This is what gets handed to
 * the model — deliberately prose, deliberately short, and containing only
 * facts derived from session events so the model has nothing to invent.
 */
export function describeCcs(ccs: CompressedCognitiveState): string {
  const lines: string[] = [];
  lines.push(`Turn ${ccs.turn}. Aspiration: "${ccs.aspiration}".`);

  const wb = AXIS_ORDER.map(
    (a) => `${AXIS_LABELS[a]} ${ccs.wellbeing[a].toFixed(1)}/10 (conf ${ccs.confidence[a].toFixed(2)})`
  ).join("; ");
  lines.push(`Wellbeing estimate — ${wb}.`);
  lines.push(
    `Strongest: ${AXIS_LABELS[ccs.strongestAxis]}. Weakest: ${AXIS_LABELS[ccs.weakestAxis]}.`
  );

  lines.push(
    `Stated interests: ${ccs.stated.interests.join(", ") || "none"}; stated format ${FORMAT_LABELS[ccs.stated.format]}; level ${ccs.stated.experience}.`
  );

  if (ccs.revealed.categories.length > 0) {
    const rev = ccs.revealed.categories
      .map((r) => `${r.category} (+${r.accept}/-${r.skip})`)
      .join(", ");
    lines.push(
      `Revealed preference: ${rev}${ccs.revealed.format ? `; accepts ${FORMAT_LABELS[ccs.revealed.format]} most` : ""}.`
    );
  } else {
    lines.push("Revealed preference: not enough accepted items yet.");
  }

  lines.push(
    `Stated-vs-revealed divergence: ${(ccs.divergence * 100).toFixed(0)}%. Passive-accept run: ${ccs.consumptionRun}. Execution debt: ${ccs.executionDebt}.`
  );
  lines.push(`Active posture: ${ccs.pivot}.`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function clampScore(v: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, round2(v)));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
