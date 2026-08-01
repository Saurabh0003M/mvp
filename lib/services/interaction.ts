// ============================================================================
// Interaction service — the primary learning signal.
// ----------------------------------------------------------------------------
// Interactions are the ONE thing that genuinely cannot be regenerated. Every
// derived structure in the product (taste weights, the compressed cognitive
// state, friction detection, insights) is a pure function of
// (profile, corpus, ordered interactions). That is why there is no belief_state
// table and no insights table: replay the interactions and you have them back,
// bit-for-bit.
//
// Two consequences shape this module:
//
//  1. Rows are APPEND-ONLY and ordered. `created_at` + `id` give a stable
//     replay order. We never update an interaction's verb after the fact.
//
//  2. The signal is DENORMALIZED onto each row (goal_topic, category, format,
//     content_type, difficulty, tier). Drift detection and replay then need no
//     joins, and — more importantly — the row records what was true *at the
//     time of the swipe*. `tier` in particular is relative to the user's
//     profile; if they later change their experience level we still know the
//     item felt like a stretch when they skipped it.
//
// Verbs: accept | skip | maybe_later are swipes. `completed` is a separate,
// later row recording that the user actually finished accepted content — the
// strongest signal we get, and the one that distinguishes "swiped right" from
// "actually learned something".
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  InteractionAction,
  InteractionRow,
} from "../supabase/types";
import type {
  Format,
  Interaction,
  Recommendation,
  SwipeDirection,
  UserProfile,
} from "../taxonomy";
import { isCategory, FORMAT_TO_CONTENT_TYPE } from "../taxonomy";
import { contentTier } from "../friction";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Verb mapping — the frontend swipes, the database records actions
// ---------------------------------------------------------------------------

/** The client's three swipe directions as stored actions. */
const DIRECTION_TO_ACTION: Record<SwipeDirection, InteractionAction> = {
  accept: "accept",
  skip: "skip",
  later: "maybe_later",
};

/** Inverse of the above, for replay. `completed` has no swipe equivalent. */
const ACTION_TO_DIRECTION: Partial<Record<InteractionAction, SwipeDirection>> = {
  accept: "accept",
  skip: "skip",
  maybe_later: "later",
};

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

/** What the caller knows at swipe time. Everything else is derived here. */
export interface SwipeEvent {
  profileId: string;
  /** The primary aspiration this swipe happened under, when known. */
  aspirationId?: string | null;
  /** The card as the engine had it — the source of the denormalized fields. */
  card: Recommendation;
  /** The profile, needed to derive the tier relative to this user. */
  profile: UserProfile;
  direction: SwipeDirection;
  /** How long the card sat on screen before the swipe. A hesitation signal. */
  timeToSwipeMs?: number | null;
}

/**
 * Persist one swipe. Returns the stored row so callers can keep its id (needed
 * to attach a later completion).
 *
 * Note this does NOT try to be idempotent: the same card can legitimately be
 * resurfaced and re-swiped ("maybe later" → accept), and each of those is a
 * real event in the timeline.
 */
export async function recordSwipe(
  supabase: Client,
  event: SwipeEvent
): Promise<InteractionRow> {
  const { card, profile } = event;

  const { data, error } = await supabase
    .from("interactions")
    .insert({
      profile_id: event.profileId,
      aspiration_id: event.aspirationId ?? null,
      content_slug: card.id,
      action: DIRECTION_TO_ACTION[event.direction],
      // Denormalized snapshot of the signal at swipe time.
      goal_topic: card.goalTopic ?? card.category,
      category: card.category,
      format: card.format,
      content_type: card.contentType ?? FORMAT_TO_CONTENT_TYPE[card.format],
      difficulty: card.difficulty,
      tier: contentTier(card, profile),
      time_to_swipe_ms: event.timeToSwipeMs ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(`recordSwipe failed: ${error.message}`);
  return data as InteractionRow;
}

/** What the caller knows when a user finishes a piece of accepted content. */
export interface CompletionEvent {
  profileId: string;
  aspirationId?: string | null;
  card: Recommendation;
  profile: UserProfile;
  /** Time spent inside the content, end to end. */
  completionTimeMs?: number | null;
}

/**
 * Record that accepted content was actually completed.
 *
 * Stored as its own row (action `completed`) rather than mutating the accept
 * row, so the timeline stays append-only and we can see the gap between
 * accepting and finishing. Replay ignores `completed` rows for swipe
 * reconstruction; they exist for engagement-quality signal and future scoring.
 */
export async function recordCompletion(
  supabase: Client,
  event: CompletionEvent
): Promise<InteractionRow> {
  const { card, profile } = event;

  const { data, error } = await supabase
    .from("interactions")
    .insert({
      profile_id: event.profileId,
      aspiration_id: event.aspirationId ?? null,
      content_slug: card.id,
      action: "completed",
      goal_topic: card.goalTopic ?? card.category,
      category: card.category,
      format: card.format,
      content_type: card.contentType ?? FORMAT_TO_CONTENT_TYPE[card.format],
      difficulty: card.difficulty,
      tier: contentTier(card, profile),
      time_to_swipe_ms: null,
      completed: true,
      completion_time_ms: event.completionTimeMs ?? null,
      completed_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw new Error(`recordCompletion failed: ${error.message}`);
  return data as InteractionRow;
}

// ---------------------------------------------------------------------------
// Reading / replay
// ---------------------------------------------------------------------------

const REPLAY_LIMIT = 500;

/**
 * Fetch a user's interactions in chronological order — the input to replay.
 * Ordered by created_at then id so ties (same-millisecond inserts) still
 * resolve to a single deterministic sequence.
 */
export async function listInteractions(
  supabase: Client,
  profileId: string,
  limit = REPLAY_LIMIT
): Promise<InteractionRow[]> {
  const { data, error } = await supabase
    .from("interactions")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`listInteractions failed: ${error.message}`);
  return (data ?? []) as InteractionRow[];
}

/**
 * Project a stored row onto the client's `Interaction` shape. Returns null for
 * `completed` rows (not swipes) and for rows whose category is outside the
 * current taxonomy — replay must never inject values the typed engine can't
 * represent.
 */
export function toInteraction(row: InteractionRow): Interaction | null {
  const direction = ACTION_TO_DIRECTION[row.action];
  if (!direction) return null;
  if (!isCategory(row.category)) return null;

  return {
    recommendationId: row.content_slug,
    category: row.category,
    format: row.format as Format,
    direction,
    timestamp: new Date(row.created_at).getTime(),
  };
}

/**
 * The swipe history in engine order, ready to feed back through `applySwipe`.
 * This is the whole persistence story for belief state: no stored weights, just
 * a deterministic re-run of what the user did.
 */
export async function getSwipeHistory(
  supabase: Client,
  profileId: string,
  limit = REPLAY_LIMIT
): Promise<Interaction[]> {
  const rows = await listInteractions(supabase, profileId, limit);
  return rows
    .map(toInteraction)
    .filter((i): i is Interaction => i !== null);
}
