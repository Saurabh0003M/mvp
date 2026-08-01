// ============================================================================
// Content service — reads the generic `content_items` corpus.
// ----------------------------------------------------------------------------
// Learning resources are modelled as generic CONTENT ITEMS, not as
// "recommendations". A content item is the durable thing (a video, an article,
// a flashcard deck); a *recommendation* is what we decide to show a particular
// user at a particular moment. Keeping them separate is what lets the card in
// the UI stay a lightweight preview while the real payload (source_url,
// content_type) is fetched on accept.
//
// MVP content types: video | article | flashcard. Enforced by a CHECK
// constraint in the migration and by ALLOWED_CONTENT_TYPES here. A quiz is NOT
// an independent type — it is an optional post-content knowledge check flagged
// by `has_check` on a video/article.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALLOWED_CONTENT_TYPES,
  type ContentItemRow,
  type ContentType,
  type Database,
} from "../supabase/types";

type Client = SupabaseClient<Database>;

/** A content item in domain shape (camelCase, typed). */
export interface ContentItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  goalTopic: string;
  contentType: ContentType;
  format: string;
  difficulty: string;
  duration: number;
  sourceUrl: string | null;
  tags: string[];
  hasCheck: boolean;
}

export function toContentItem(row: ContentItemRow): ContentItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    goalTopic: row.goal_topic,
    contentType: row.content_type,
    format: row.format,
    difficulty: row.difficulty,
    duration: row.duration,
    sourceUrl: row.source_url,
    tags: row.tags ?? [],
    hasCheck: row.has_check,
  };
}

export interface ContentQuery {
  /** Restrict to these goal topics — the guardrail for on-goal retrieval. */
  goalTopics?: string[];
  /** Restrict to specific content types (subset of the allowed three). */
  contentTypes?: ContentType[];
  /** Max rows. Defaults to a sane page size; the MVP corpus is small. */
  limit?: number;
}

const DEFAULT_LIMIT = 200;

/** True when a string is one of the content types this build supports. */
export function isAllowedContentType(value: string): value is ContentType {
  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(value);
}

/**
 * Fetch content items, optionally scoped by goal topic and content type.
 * Deliberately simple: the corpus is small in the MVP, so there is no cursor
 * pagination or ANN search yet. `embedding` is selected out — it is future-ready
 * storage, not something the MVP reads.
 */
export async function listContentItems(
  supabase: Client,
  query: ContentQuery = {}
): Promise<ContentItem[]> {
  let q = supabase
    .from("content_items")
    .select(
      "id, slug, title, description, goal_topic, content_type, format, difficulty, duration, source_url, tags, has_check, created_at"
    )
    .limit(query.limit ?? DEFAULT_LIMIT);

  if (query.goalTopics?.length) {
    q = q.in("goal_topic", query.goalTopics);
  }
  if (query.contentTypes?.length) {
    q = q.in("content_type", query.contentTypes);
  }

  const { data, error } = await q;
  if (error) throw new Error(`listContentItems failed: ${error.message}`);
  return (data as ContentItemRow[]).map(toContentItem);
}

/** Fetch one content item by its stable slug (what interactions reference). */
export async function getContentItemBySlug(
  supabase: Client,
  slug: string
): Promise<ContentItem | null> {
  const { data, error } = await supabase
    .from("content_items")
    .select(
      "id, slug, title, description, goal_topic, content_type, format, difficulty, duration, source_url, tags, has_check, created_at"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`getContentItemBySlug failed: ${error.message}`);
  return data ? toContentItem(data as ContentItemRow) : null;
}
