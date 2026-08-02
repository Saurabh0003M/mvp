// ============================================================================
// Replay — rebuild the full engine state from stored interactions.
// ----------------------------------------------------------------------------
// This is the single mechanism that lets the backend persist almost nothing.
//
// `EngineState` is a LEFT FOLD of `applySwipe` over the ordered interaction
// history, starting from `createEngine(profile)`:
//
//     state = interactions.reduce(applySwipe, createEngine(profile))
//
// Both functions are deterministic and `compressCognitiveState` is a pure
// function of (history, profile, corpus) — it doesn't read interaction
// timestamps, only their ORDER. So given (profile, ordered interactions) we can
// reconstruct weights, counters, queue, accepted, later, seen and the compressed
// cognitive state exactly, bit for bit.
//
// That is why there is no belief_state table and no insights table: they would
// be caches of a pure function over data we already store. Interactions are the
// only ground truth.
//
// One deliberate limitation, documented rather than engineered around: the
// client engine resolves its corpus from the module-level `LIVE_CORPUS`
// constant, so replay is exact as long as the seeded `content_items` rows carry
// the same slugs as that corpus (which the migration guarantees). Making the
// corpus fully injectable would mean threading a parameter through the entire
// engine — real work for zero MVP benefit, and easy to do later behind this
// same function signature.
// ============================================================================

import {
  LIVE_CORPUS,
  applySwipe,
  createEngine,
  type EngineState,
} from "../engine";
import type { Interaction, Recommendation, UserProfile } from "../taxonomy";

/** Corpus lookup by the id the engine keys on (== content_items.slug). */
function corpusById(
  corpus: Recommendation[]
): Map<string, Recommendation> {
  return new Map(corpus.map((c) => [c.id, c]));
}

/**
 * Rebuild engine state by replaying history through the real engine.
 *
 * Interactions referencing content that no longer exists are SKIPPED rather
 * than throwing: content can be removed from the corpus after a user swiped it,
 * and one retired item must not make a user's whole history unreadable.
 */
export function replayEngineState(
  profile: UserProfile,
  history: Interaction[],
  corpus: Recommendation[] = LIVE_CORPUS
): EngineState {
  const byId = corpusById(corpus);

  return history.reduce<EngineState>((state, interaction) => {
    const card = byId.get(interaction.recommendationId);
    if (!card) return state;
    return applySwipe(state, card, interaction.direction, profile);
  }, createEngine(profile));
}
