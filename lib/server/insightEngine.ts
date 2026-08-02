// ============================================================================
// Insight engine (server-side) — the pattern the system is ready to name.
// ----------------------------------------------------------------------------
// Insights are DERIVED, not stored. `detectInsight` is a pure function of
// (engine state, profile), and engine state is itself a fold over interactions,
// so an insights table would be a cache of a cache. Recomputing also means a
// change to a threshold takes effect immediately instead of leaving stale rows
// behind.
//
// The one piece of genuinely non-derivable insight data is which insights the
// user DISMISSED or APPLIED — that is a user decision, not a computation. In the
// MVP those live in client engine state for the session. Persisting them later
// means one small table (or two text[] columns on `profiles`); the shape of this
// module does not change when that happens, which is why `dismissed` and
// `applied` are parameters here rather than assumptions.
//
// Ordering is inherited from lib/engine.ts and matters: FRICTION is checked
// before CONTRADICTION, so a user struggling with hard content in a chosen goal
// is never told their interests are changing. Reducing difficulty is the answer,
// never switching the goal.
// ============================================================================

import { LIVE_CORPUS, detectInsight, type Insight } from "../engine";
import { detectFriction, type FrictionState } from "../friction";
import type { Interaction, Recommendation, UserProfile } from "../taxonomy";
import { replayEngineState } from "./replay";

export interface InsightResult {
  /** The single highest-priority insight, or null if no pattern has crossed a threshold. */
  insight: Insight | null;
  /** Friction status, included so callers can see the goal is being preserved. */
  friction: FrictionState;
}

export interface InsightOptions {
  /** Insight ids the user explicitly dismissed — never re-surface these. */
  dismissed?: string[];
  /** Insight ids the user already applied. */
  applied?: string[];
  corpus?: Recommendation[];
}

/**
 * Detect the current insight for a user from stored history.
 *
 * Note the `friction` insight's target is always a FORMAT ("bite"), never a
 * category — by construction there is no code path here that can move weight off
 * a stated goal in response to friction.
 */
export function computeInsight(
  profile: UserProfile,
  history: Interaction[],
  options: InsightOptions = {}
): InsightResult {
  const corpus = options.corpus ?? LIVE_CORPUS;
  const state = replayEngineState(profile, history, corpus);

  // Fold the user's own dismiss/apply decisions into the replayed state. These
  // are the only insight facts that cannot be recomputed from behaviour.
  const withDecisions = {
    ...state,
    dismissedInsights: new Set(options.dismissed ?? []),
    appliedInsights: new Set(options.applied ?? []),
  };

  return {
    insight: detectInsight(withDecisions, profile),
    friction: detectFriction(history, profile, corpus),
  };
}
