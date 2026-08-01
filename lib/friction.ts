// ============================================================================
// Friction layer — "narrow the friction, not the topic."
// ----------------------------------------------------------------------------
// Ascend's differentiation: when a user repeatedly skips HARD content in a goal
// they chose, that is friction/fatigue, NOT a change of interest. The correct
// response is to lower the *effort* (difficulty/format) while keeping the SAME
// goal_topic — never to switch topics for the sake of engagement.
//
// This module is a small, deterministic, dependency-light layer that sits ON
// TOP of the existing recommendation engine. It does three things and nothing
// more:
//
//   1. contentTier(card, profile)  — classify an item's effort RELATIVE to the
//      user as "stretch" | "bridge" | "easy". Tier is not stored on the item
//      (it depends on the user), it is derived here.
//
//   2. detectFriction(history, profile, corpus) — a rule-based detector: N
//      consecutive skips of *stretch* items within a goal topic → friction on
//      that topic. Any accept resets the run. No ML, by design.
//
//   3. applyFrictionRerank(queue, friction, profile) — a final ORDERING pass:
//      lift low-effort same-topic items toward the top, push stretch items
//      down. It only reorders items already in the queue and NEVER promotes an
//      off-goal item above a goal item — the HARD RULE, enforced structurally.
//
// It is pure and isomorphic so the client engine and any server wrapper share
// exactly one implementation.
// ============================================================================

import {
  type Category,
  type Difficulty,
  type Format,
  type Interaction,
  type Recommendation,
  type UserProfile,
} from "./taxonomy";

// ---------------------------------------------------------------------------
// Tier classification
// ---------------------------------------------------------------------------

export type Tier = "stretch" | "bridge" | "easy";

const DIFFICULTY_RANK: Record<Difficulty, number> = {
  Beginner: 0,
  Intermediate: 1,
  Advanced: 2,
};

// Formats ordered by cognitive effort. Building a project is heavier than
// watching a short video; bite-sized reps are the lightest. This mirrors the
// worked example (lecture → article → flashcards → short video), which is a
// descent through exactly these levels.
const FORMAT_EFFORT: Record<Format, number> = {
  project: 3,
  read: 2,
  video: 1,
  bite: 0,
};

/**
 * Classify how much effort an item asks of THIS user, as stretch/bridge/easy.
 *
 * Effort combines three signals, each intentionally simple:
 *  - difficulty gap: item difficulty minus the user's stated level. Content
 *    above their level is a stretch; at/below is easier.
 *  - format effort: project/read cost more than video/bite.
 *  - duration: anything over the user's daily time window adds effort.
 *
 * The thresholds are deliberately coarse — this is a heuristic that decides
 * ordering nudges, not a score anyone sees.
 */
export function contentTier(
  card: Recommendation,
  profile: UserProfile
): Tier {
  const gap = DIFFICULTY_RANK[card.difficulty] - DIFFICULTY_RANK[profile.experience];
  const formatEffort = FORMAT_EFFORT[card.format];
  const overTime = card.duration > profile.dailyTime ? 1 : 0;

  // Weighted so difficulty-above-level dominates, format modulates, and an
  // over-budget duration can tip a borderline item up a tier.
  const effort = gap * 2 + formatEffort + overTime;

  if (effort >= 4) return "stretch";
  if (effort >= 2) return "bridge";
  return "easy";
}

/** Effort rank for sorting: easy < bridge < stretch. */
const TIER_RANK: Record<Tier, number> = { easy: 0, bridge: 1, stretch: 2 };

// ---------------------------------------------------------------------------
// Friction detection
// ---------------------------------------------------------------------------

export interface FrictionState {
  /** Whether friction is currently active for at least one goal topic. */
  active: boolean;
  /** Goal topics (categories) the user is showing friction in. */
  topics: Category[];
  /** Consecutive stretch-skips that triggered it, per topic — for receipts. */
  runByTopic: Record<string, number>;
}

/** Consecutive stretch-skips within a topic before friction fires. */
export const FRICTION_THRESHOLD = 2;

/**
 * The user's "goal set": the categories they explicitly committed to. Friction
 * only ever operates inside this set, and the re-rank never elevates anything
 * outside it — this is the anchor for the HARD RULE.
 */
export function goalTopics(profile: UserProfile): Category[] {
  return profile.interests;
}

/**
 * Detect friction from the interaction history. Rule-based and deterministic:
 * walk history newest-first per goal topic; count consecutive skips of stretch
 * items; an accept (or maybe_later) in that topic resets the count. If the run
 * reaches the threshold, that topic is in friction.
 *
 * `corpus` is needed to recover each interacted card's tier. Interactions from
 * Supabase already carry a snapshotted tier, but the client engine works from
 * the in-memory corpus, so we recompute here to keep a single code path.
 */
export function detectFriction(
  history: Interaction[],
  profile: UserProfile,
  corpus: Recommendation[]
): FrictionState {
  const byId = new Map(corpus.map((c) => [c.id, c]));
  const goals = new Set<Category>(goalTopics(profile));

  // Per-topic newest-first scan.
  const runByTopic: Record<string, number> = {};
  const topics: Category[] = [];

  for (const topic of goals) {
    let run = 0;
    // Newest first.
    for (let i = history.length - 1; i >= 0; i--) {
      const it = history[i];
      if (it.category !== topic) continue;

      if (it.direction === "accept" || it.direction === "later") {
        break; // engagement in-topic clears the friction run
      }
      if (it.direction === "skip") {
        const card = byId.get(it.recommendationId);
        // Only a skipped STRETCH item counts as friction. Skipping an easy
        // item in-topic is ordinary disinterest, not fatigue.
        if (card && contentTier(card, profile) === "stretch") {
          run++;
        } else {
          break; // a non-stretch skip ends the stretch run
        }
      }
    }
    if (run >= FRICTION_THRESHOLD) {
      topics.push(topic);
      runByTopic[topic] = run;
    }
  }

  return { active: topics.length > 0, topics, runByTopic };
}

// ---------------------------------------------------------------------------
// Friction re-rank
// ---------------------------------------------------------------------------

/**
 * Reorder the queue to reduce friction WITHOUT changing the topic mix.
 *
 * When friction is active, within the frictioned topics we bring easier items
 * forward (easy before bridge before stretch). Crucially this is a *stable*
 * reordering that operates only on the relative order of items — it does not
 * inject off-goal content and does not let a non-goal item jump ahead of a
 * goal item. The engine's relevance/diversity ordering is preserved everywhere
 * friction is not active.
 *
 * Returns a new array; never mutates the input.
 */
export function applyFrictionRerank(
  queue: Recommendation[],
  friction: FrictionState,
  profile: UserProfile
): Recommendation[] {
  if (!friction.active) return queue;

  const frictioned = new Set(friction.topics);
  const goals = new Set<Category>(goalTopics(profile));

  // Decorate with original index so we can keep a stable sort.
  const decorated = queue.map((card, index) => {
    const inFrictionTopic = frictioned.has(card.category);
    const tier = contentTier(card, profile);
    return { card, index, inFrictionTopic, tier };
  });

  decorated.sort((a, b) => {
    // 1) HARD RULE: never let an off-goal item outrank a goal item. Goal items
    //    always sort ahead of non-goal items, regardless of friction.
    const aGoal = goals.has(a.card.category) ? 1 : 0;
    const bGoal = goals.has(b.card.category) ? 1 : 0;
    if (aGoal !== bGoal) return bGoal - aGoal;

    // 2) Within a frictioned goal topic, prefer lower effort (easy first). This
    //    is the "lower the difficulty, keep the goal" behavior.
    if (a.inFrictionTopic && b.inFrictionTopic) {
      const tierDelta = TIER_RANK[a.tier] - TIER_RANK[b.tier];
      if (tierDelta !== 0) return tierDelta;
    } else if (a.inFrictionTopic !== b.inFrictionTopic) {
      // Bring frictioned-topic items that are easy/bridge slightly forward so
      // the user immediately sees a gentler on-ramp in the topic they're stuck
      // on — but only the non-stretch ones, so we don't surface more of what
      // they're skipping.
      const aBoost = a.inFrictionTopic && a.tier !== "stretch" ? 1 : 0;
      const bBoost = b.inFrictionTopic && b.tier !== "stretch" ? 1 : 0;
      if (aBoost !== bBoost) return bBoost - aBoost;
    }

    // 3) Otherwise preserve the engine's original order (stable).
    return a.index - b.index;
  });

  return decorated.map((d) => d.card);
}

// ---------------------------------------------------------------------------
// Skip attribution — is this skip friction, or genuine disinterest?
// ---------------------------------------------------------------------------

/**
 * A skip should only erode a topic's category weight when it reflects
 * disinterest. Skipping a STRETCH item inside a goal topic is friction — the
 * user still wants the goal, just not at that difficulty — so the engine
 * should NOT decay the category on that skip (it may still learn the format
 * preference). Returns true when the category weight decay should be skipped.
 */
export function isFrictionSkip(
  card: Recommendation,
  direction: Interaction["direction"],
  profile: UserProfile
): boolean {
  if (direction !== "skip") return false;
  if (!goalTopics(profile).includes(card.category)) return false;
  return contentTier(card, profile) === "stretch";
}
