// ============================================================================
// Recommendation service — maps CONTENT ITEMS to the frontend's Recommendation.
// ----------------------------------------------------------------------------
// This is the seam between storage and the UI, and the place a real AI
// retriever drops in later.
//
// The frontend renders four formats (project | read | video | bite) and must
// stay unchanged. The corpus stores richer content types (video | article |
// flashcard). This module owns that projection:
//
//     video     → video   (player)
//     article   → read    (reader)
//     flashcard → bite    (flashcard viewer)
//
// The original `content_type` and `source_url` ride along as OPTIONAL fields on
// Recommendation. Current components ignore them, so nothing changes visually;
// the accept-flow can later branch on `contentType` and fetch `sourceUrl`
// without a type or schema change.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentType, Database } from "../supabase/types";
import type { Difficulty, Format, Recommendation } from "../taxonomy";
import { isCategory, isFormat, CONTENT_TYPE_TO_FORMAT } from "../taxonomy";
import { listContentItems, type ContentItem } from "./content";

type Client = SupabaseClient<Database>;

/** Map a stored content type to the format the frontend card renders.
 *  Uses the shared CONTENT_TYPE_TO_FORMAT mapping from taxonomy.ts with a
 *  defensive fallback for any future content types not yet in the map. */
export function contentTypeToFormat(contentType: ContentType): Format {
  return CONTENT_TYPE_TO_FORMAT[contentType] ?? "bite";
}

/**
 * Project a stored content item into the exact shape the client engine and UI
 * already consume. `id` is the item's SLUG, because the engine keys everything
 * (seen set, queue filtering, interaction history) on that id and the seeded
 * slugs match the original hardcoded corpus ids — so a Supabase-backed corpus
 * is a drop-in replacement.
 */
export function toRecommendation(item: ContentItem): Recommendation | null {
  // The engine's Category union is closed; skip rows whose topic isn't one of
  // them rather than corrupting typed state. (Widening the taxonomy is a
  // deliberate product decision, not something a DB row should force.)
  if (!isCategory(item.goalTopic)) return null;

  const format = isFormat(item.format)
    ? item.format
    : contentTypeToFormat(item.contentType);

  return {
    id: item.slug,
    title: item.title,
    description: item.description,
    category: item.goalTopic,
    format,
    difficulty: item.difficulty as Difficulty,
    duration: item.duration,
    tags: item.tags,
    // Optional, backend-only metadata (ignored by current components).
    contentType: item.contentType,
    sourceUrl: item.sourceUrl,
    goalTopic: item.goalTopic,
    hasCheck: item.hasCheck,
  };
}

/**
 * Fetch the corpus as frontend-ready Recommendations.
 *
 * This is what `fetchRecommendations()` in lib/engine.ts delegates to when
 * Supabase is configured. Scoping by `goalTopics` is optional: the client
 * engine wants the whole corpus so its scoring/diversity/friction passes can
 * see everything, while a future server-side retriever can narrow first.
 *
 * FUTURE AI SEAM: replace the body with an embedding/ANN query or an LLM
 * re-ranker. The return type must stay Recommendation[] and the results must
 * remain on-goal — the HARD RULE ("narrow the friction, not the topic") is a
 * retrieval invariant, not just a client-side ordering rule.
 */
export async function fetchCorpus(
  supabase: Client,
  goalTopics?: string[]
): Promise<Recommendation[]> {
  const items = await listContentItems(supabase, { goalTopics });
  return items
    .map(toRecommendation)
    .filter((r): r is Recommendation => r !== null);
}
