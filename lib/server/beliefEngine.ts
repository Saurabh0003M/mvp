// ============================================================================
// Belief engine (server-side) — what the system currently believes about a user.
// ----------------------------------------------------------------------------
// "Belief state" = the taste weights, the accept/skip counters, and the
// Compressed Cognitive State (the six-axis wellbeing read plus stated-vs-revealed
// divergence). All three are DERIVED, never stored:
//
//   weights/counters  ← fold of applySwipe over interactions
//   ccs               ← pure function of (history, profile, corpus)
//
// Persisting them would create a cache that can silently disagree with the
// interactions that produced it, and would need invalidating every time the
// scoring constants change. Recomputing is O(history) over a few hundred rows —
// far cheaper than the correctness risk.
//
// This module reuses lib/engine.ts and lib/cognitive.ts directly; it defines no
// scoring rules of its own.
// ============================================================================

import { LIVE_CORPUS, topWeights, trajectory } from "../engine";
import {
  compressCognitiveState,
  describeCcs,
  type CompressedCognitiveState,
} from "../cognitive";
import { detectFriction, type FrictionState } from "../friction";
import type {
  Counters,
  Interaction,
  Recommendation,
  UserProfile,
  Weights,
} from "../taxonomy";
import { replayEngineState } from "./replay";

export interface BeliefState {
  /** Normalized taste weights across categories and formats. */
  weights: Weights;
  /** Raw accept/skip/later tallies — the receipts behind every insight. */
  counters: Counters;
  /** The six-axis cognitive/wellbeing compression. */
  ccs: CompressedCognitiveState;
  /** Human-readable one-liner describing the CCS. */
  summary: string;
  /** The four bars the Taste Profile rail renders. */
  topWeights: { label: string; value: number; accent: string }[];
  /** The trajectory copy shown under the deck. */
  trajectory: string;
  /** Current friction status per goal topic. */
  friction: FrictionState;
  /** Counts of what the user has engaged with, for quick client checks. */
  totals: { accepted: number; later: number; interactions: number };
}

/**
 * Compute the full belief state for a user from their profile and history.
 * Deterministic: same inputs always produce the same output.
 */
export function computeBeliefState(
  profile: UserProfile,
  history: Interaction[],
  corpus: Recommendation[] = LIVE_CORPUS
): BeliefState {
  const state = replayEngineState(profile, history, corpus);
  const ccs = compressCognitiveState(history, profile, corpus);

  return {
    weights: state.weights,
    counters: state.counters,
    ccs,
    summary: describeCcs(ccs),
    topWeights: topWeights(state, profile),
    trajectory: trajectory(state, profile),
    friction: detectFriction(history, profile, corpus),
    totals: {
      accepted: state.accepted.length,
      later: state.later.length,
      interactions: history.length,
    },
  };
}
