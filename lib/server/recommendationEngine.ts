// ============================================================================
// Recommendation engine (server-side) — a thin wrapper, not a second engine.
// ----------------------------------------------------------------------------
// The real ranking logic lives in lib/engine.ts (relevance + DPP diversity) and
// lib/friction.ts (the friction re-rank). This module does NOT reimplement any
// of it: it replays the user's history to recover engine state and reads the
// queue the engine already produced. One source of truth, so the API and the
// client can never disagree about what to show.
//
// PLACEHOLDER STATUS: this is the seam where a real retrieval model goes later
// (embeddings + ANN over content_items.embedding, or an LLM re-ranker). The
// contract that must survive that swap:
//
//   1. Return Recommendation[] in display order.
//   2. NEVER return off-goal content in preference to on-goal content. The
//      HARD RULE is a retrieval invariant, not just a client ordering nicety —
//      if the user is struggling, reduce difficulty, never the goal.
// ============================================================================

import { LIVE_CORPUS, whyThis } from "../engine";
import {
  detectFriction,
  contentTier,
  type FrictionState,
  type Tier,
} from "../friction";
import type { Interaction, Recommendation, UserProfile } from "../taxonomy";
import { replayEngineState } from "./replay";

export interface RecommendationResult {
  /** The ordered queue, exactly as the client engine would compute it. */
  items: Recommendation[];
  /** Friction status, so callers can explain WHY the order looks like it does. */
  friction: FrictionState;
  /** Per-item effort tier relative to this user, keyed by item id. */
  tiers: Record<string, Tier>;
}

/**
 * Compute the next recommendations for a user from their stored history.
 *
 * `limit` trims the head of the queue; the engine has already ordered it, so
 * taking the first N is the correct projection.
 */
export function getRecommendations(
  profile: UserProfile,
  history: Interaction[],
  corpus: Recommendation[] = LIVE_CORPUS,
  limit = 20
): RecommendationResult {
  const state = replayEngineState(profile, history, corpus);
  const items = state.queue.slice(0, limit);

  const tiers: Record<string, Tier> = {};
  for (const item of items) {
    tiers[item.id] = contentTier(item, profile);
  }

  return {
    items,
    friction: detectFriction(history, profile, corpus),
    tiers,
  };
}

/**
 * The grounded "why this card" explanation for a single item, computed from
 * replayed state so it matches what the user actually did.
 */
export function explainRecommendation(
  profile: UserProfile,
  history: Interaction[],
  cardId: string,
  corpus: Recommendation[] = LIVE_CORPUS
): string | null {
  const card = corpus.find((c) => c.id === cardId);
  if (!card) return null;
  const state = replayEngineState(profile, history, corpus);
  return whyThis(card, state, profile);
}
