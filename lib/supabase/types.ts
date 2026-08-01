// ============================================================================
// Database types — the shape of every row as it lives in Supabase.
// ----------------------------------------------------------------------------
// Hand-written (not generated) so the file is readable and reviewable, but it
// mirrors what `supabase gen types typescript` would produce. Import `Database`
// into the Supabase clients for end-to-end row typing.
//
// Design notes tied to the product decisions:
//  - Only data that CANNOT be deterministically regenerated is persisted:
//    profiles, aspirations, content_items, interactions. Belief state and
//    insights are pure functions of (profile, interactions, corpus) and are
//    computed on demand — they have no tables here on purpose.
//  - `content_type` is a plain text column constrained by a CHECK in the
//    migration. Adding a type later is a one-line ALTER, never a redesign.
// ============================================================================

// ContentType and ALLOWED_CONTENT_TYPES are defined once in lib/taxonomy.ts (the
// shared vocabulary). Imported here for use in the row types below, and
// re-exported so existing imports from supabase/types keep resolving.
import type { ContentType } from "../taxonomy";
import { ALLOWED_CONTENT_TYPES } from "../taxonomy";
export { type ContentType, ALLOWED_CONTENT_TYPES };

/** Interaction verbs stored as the primary learning signal. */
export type InteractionAction = "accept" | "skip" | "maybe_later" | "completed";

// NOTE ON `type` VS `interface` BELOW:
// Every row shape here is a `type` alias, deliberately. postgrest-js constrains
// each table to `Row extends Record<string, unknown>`, and TypeScript only
// grants an implicit index signature to type ALIASES — an `interface` never
// satisfies `Record<string, unknown>` (it stays open to declaration merging).
// Declaring these as interfaces makes the schema fail postgrest's GenericSchema
// constraint, which resolves `Schema` to `never` and silently degrades every
// insert/update payload to `never` while reads keep working. Keep them aliases.

export type ProfileRow = {
  id: string; // = auth.users.id (anonymous session)
  experience: string; // Difficulty
  learning_style: string; // Format
  daily_time: number; // 15 | 30 | 60
  created_at: string;
  updated_at: string;
};

export type AspirationRow = {
  id: string;
  profile_id: string;
  title: string; // free-text goal, e.g. "Backend Engineer"
  interests: string[]; // Category[]
  is_primary: boolean; // the frontend uses the primary aspiration
  created_at: string;
};

export type ContentItemRow = {
  id: string;
  slug: string; // stable id used by the engine, e.g. "ai-1"
  title: string;
  description: string;
  goal_topic: string; // the topic the item belongs to (maps to Category today)
  content_type: ContentType;
  format: string; // frontend Format the card renders (video|read|bite|project)
  difficulty: string; // Beginner | Intermediate | Advanced
  duration: number; // minutes
  source_url: string | null; // where the real content is fetched from on accept
  tags: string[];
  has_check: boolean; // an optional post-content knowledge check (quiz) exists
  embedding: number[] | null; // future-ready; nullable, no pgvector dependency
  created_at: string;
};

export type InteractionRow = {
  id: string;
  profile_id: string;
  aspiration_id: string | null;
  content_slug: string; // references content_items.slug (denormalized)
  action: InteractionAction;
  // Denormalized signal — lets drift/replay run without joins.
  goal_topic: string;
  category: string;
  format: string;
  content_type: string;
  difficulty: string;
  tier: string; // stretch | bridge | easy, snapshotted at interaction time
  time_to_swipe_ms: number | null;
  completed: boolean;
  completion_time_ms: number | null;
  completed_at: string | null;
  created_at: string;
};

/** Rows as required for insert (DB fills id/defaults/timestamps). */
export type ProfileInsert = Pick<
  ProfileRow,
  "id" | "experience" | "learning_style" | "daily_time"
>;
export type AspirationInsert = Pick<
  AspirationRow,
  "profile_id" | "title" | "interests"
> &
  Partial<Pick<AspirationRow, "is_primary">>;
export type InteractionInsert = Pick<
  InteractionRow,
  | "profile_id"
  | "content_slug"
  | "action"
  | "goal_topic"
  | "category"
  | "format"
  | "content_type"
  | "difficulty"
  | "tier"
> &
  Partial<
    Pick<
      InteractionRow,
      | "aspiration_id"
      | "time_to_swipe_ms"
      | "completed"
      | "completion_time_ms"
      | "completed_at"
    >
  >;

/**
 * The schema shape supabase-js expects as its generic argument.
 *
 * Two non-obvious requirements, both of which fail SILENTLY (reads keep working
 * while every insert/update payload degrades to `never`):
 *  - `Views` and `Functions` must be present — postgrest's GenericSchema
 *    constraint requires them even when empty.
 *  - Row types must be type aliases, not interfaces (see the note above).
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      aspirations: {
        Row: AspirationRow;
        Insert: AspirationInsert;
        Update: Partial<AspirationRow>;
        Relationships: [];
      };
      content_items: {
        Row: ContentItemRow;
        Insert: Partial<ContentItemRow>;
        Update: Partial<ContentItemRow>;
        Relationships: [];
      };
      interactions: {
        Row: InteractionRow;
        Insert: InteractionInsert;
        Update: Partial<InteractionRow>;
        Relationships: [];
      };
    };
    // `{ [_ in never]: never }` — not `Record<string, never>` — is the idiom
    // Supabase's own type generator emits for empty schema sections. A wildcard
    // index signature here would intersect into the table lookups.
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
