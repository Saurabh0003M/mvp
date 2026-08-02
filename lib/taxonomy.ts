// ============================================================================
// Shared taxonomy — types, constants, and the content corpus.
// ----------------------------------------------------------------------------
// Extracted out of engine.ts so the recommendation engine and the cognitive
// layer can both depend on the shared vocabulary without depending on each
// other. engine.ts re-exports everything in this file, so every existing
// `import { ... } from "@/lib/engine"` in the UI keeps resolving unchanged.
//
// Without this split, engine -> cognitive -> engine forms a module cycle, and
// ES module cycles that touch `const` bindings at evaluation time throw
// temporal-dead-zone errors that only appear in the production bundle. Cheaper
// to prevent than to debug at 3am.
// ============================================================================

export type Category =
  | "AI/ML"
  | "Cybersecurity"
  | "Web Dev"
  | "Basketball"
  | "Design"
  | "Business"
  | "Data Science"
  | "Creative Writing";

export type Format = "project" | "read" | "video" | "bite";
export type Difficulty = "Beginner" | "Intermediate" | "Advanced";
export type LearningStyle = "project" | "read" | "video" | "bite";

/**
 * The concrete kind of learning resource behind a recommendation. The card in
 * the UI is only a preview; on accept the frontend fetches/opens the real
 * content by type (video → player, article → reader, flashcard → viewer).
 * MVP-supported set is video | article | flashcard — kept in sync with the
 * CHECK constraint in database/schema.sql. Adding a type later is a one-line
 * ALTER, never a redesign.
 *
 * This type also serves as the routing key for future external API integrations:
 *   video     → YouTube API
 *   article   → Article API
 *   flashcard → Internal flashcard viewer
 */
export type ContentType = "video" | "article" | "flashcard";

/** The single source of truth for allowed content types. The app and the DB
 *  CHECK constraint must agree; change both together (one line each). */
export const ALLOWED_CONTENT_TYPES: readonly ContentType[] = [
  "video",
  "article",
  "flashcard",
] as const;

/**
 * Maps the engine's internal format to the database content_type.
 *
 * Two formats (project, read) both map to "article" because they represent
 * article-like content rendered with different UI previews. This mapping is
 * used when persisting interactions — the card's optional `contentType` field
 * takes precedence when present (i.e. when the item came from Supabase).
 */
export const FORMAT_TO_CONTENT_TYPE: Record<Format, ContentType> = {
  project: "article",
  read: "article",
  video: "video",
  bite: "flashcard",
};

/**
 * Maps a database content_type back to the default engine format.
 *
 * Used as a fallback when content comes from Supabase and the stored `format`
 * field is missing or invalid. Note: "article" defaults to "read"; the actual
 * format is stored separately on content_items and should be preferred.
 */
export const CONTENT_TYPE_TO_FORMAT: Record<ContentType, Format> = {
  video: "video",
  article: "read",
  flashcard: "bite",
};

/**
 * What kind of *media* this actually is — not how hard it is, but what
 * happens when you accept it. The problem statement asks for "media,
 * knowledge and experiences", so the curator has to be able to hand you a
 * track to work to, a mentor to talk to, or a thing to go do — not only
 * something to read. `format`/`difficulty` describe cognitive shape;
 * `mediaKind` decides which player opens.
 */
export type MediaKind =
  | "video"      // YouTube / talk / explainer  → embedded player
  | "music"      // focus / recovery audio      → embedded player
  | "podcast"    // long-form audio, incl. BeU  → audio player
  | "article"    // read                        → reader / source link
  | "practice"   // a real-world experience     → do-it-now checklist
  | "mentor";    // a person to learn from      → profile + consult

/**
 * IABTM's own Curated Media channels, verbatim from their platform. Their
 * library is organised by MEDIUM (and in a culture/human-potential register),
 * not by developer skill — which is exactly the "media direction" our first
 * corpus was missing. Ingested items carry one of these.
 */
export const IABTM_CHANNELS = [
  "Film",
  "Music",
  "Art",
  "Animation",
  "Editorial",
  "Print",
] as const;

export type IabtmChannel = (typeof IABTM_CHANNELS)[number];

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  video: "Watch",
  music: "Listen",
  podcast: "Listen",
  article: "Read",
  practice: "Do",
  mentor: "Meet",
};

/** Verb shown on the accept button, so the payoff is promised before the tap. */
export const MEDIA_KIND_ACTION: Record<MediaKind, string> = {
  video: "Play it",
  music: "Play it",
  podcast: "Play it",
  article: "Read it",
  practice: "Start it",
  mentor: "Meet them",
};

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: Category;
  format: Format;
  difficulty: Difficulty;
  duration: number; // minutes
  tags: string[];
  /**
   * The curiosity hook. This is what the card leads with — an open loop the
   * user wants closed. Stating the topic ("Habit Formation · 30 min") prices
   * the content and reads as homework; opening a gap ("Why does day 4 break
   * most people?") creates the pull. Information-gap theory, applied to a
   * card. Falls back to `title` when absent.
   */
  hook?: string;
  /** Which player opens on accept. Falls back to a guess from `format`. */
  mediaKind?: MediaKind;
  /** IABTM Curated Media channel this belongs to (Film/Music/Art/…). */
  channel?: IabtmChannel;
  /** Embeddable URL (YouTube/Spotify embed src, audio file, article link). */
  embedUrl?: string;
  /** For `mentor` cards: who they are. */
  mentor?: { name: string; role: string; avatar?: string };
  /** For `practice` cards: the concrete steps of the experience. */
  steps?: string[];
  // --- Optional backend-backed fields (additive, ignored by current UI) ---
  // Present when the item comes from the Supabase `content_items` corpus. The
  // existing components never read these, so adding them changes nothing
  // visually; they exist so the accept-flow can later branch on content_type
  // and fetch from source_url without a schema or type change.
  /** Concrete resource kind. Maps to `format` for the card preview. */
  contentType?: ContentType;
  /** Where the real content is fetched/opened from on accept. */
  sourceUrl?: string | null;
  /** The topic this item belongs to; equals `category` today. */
  goalTopic?: string;
  /** An optional lightweight post-content knowledge check (quiz) exists. */
  hasCheck?: boolean;
  // Optional presentational fields — the corpus in engine.ts doesn't set these,
  // so the UI falls back to a category-accent gradient and an "IABTM" source.
  thumbnail?: string;
  url?: string;
  source?: string;
  tier?: string;
}

export interface UserProfile {
  aspiration: string;
  interests: Category[];
  experience: Difficulty;
  learningStyle: LearningStyle;
  dailyTime: 15 | 30 | 45 | 60;
}

export type SwipeDirection = "accept" | "skip" | "later";

export interface Interaction {
  recommendationId: string;
  category: Category;
  format: Format;
  direction: SwipeDirection;
  timestamp: number;
}

export interface Weights {
  categories: Record<Category, number>;
  formats: Record<Format, number>;
}

export interface Counters {
  categories: Record<Category, { accept: number; skip: number; later: number }>;
  formats: Record<Format, { accept: number; skip: number; later: number }>;
}

export const ALL_CATEGORIES: Category[] = [
  "AI/ML",
  "Cybersecurity",
  "Web Dev",
  "Basketball",
  "Design",
  "Business",
  "Data Science",
  "Creative Writing",
];

export const ALL_FORMATS: Format[] = ["project", "read", "video", "bite"];

/**
 * Runtime guards for the two closed unions. The engine's types are closed on
 * purpose, but data arriving from the database is just text — these are the
 * single checkpoint where an untyped string becomes a typed value. Widening the
 * taxonomy stays a deliberate product decision rather than something a stray
 * row can force.
 */
export function isCategory(value: string): value is Category {
  return (ALL_CATEGORIES as string[]).includes(value);
}

export function isFormat(value: string): value is Format {
  return (ALL_FORMATS as string[]).includes(value);
}

/**
 * Which player a card opens. Explicit `mediaKind` wins; otherwise we infer a
 * sensible default from the cognitive format so every legacy corpus item
 * still opens something rather than nothing.
 */
export function resolveMediaKind(card: Recommendation): MediaKind {
  if (card.mediaKind) return card.mediaKind;
  if (card.format === "video") return "video";
  if (card.format === "project") return "practice";
  return "article";
}

export const FORMAT_LABELS: Record<Format, string> = {
  project: "Project-based",
  read: "Reading",
  video: "Video",
  bite: "Bite-sized",
};

export const CATEGORY_ACCENTS: Record<Category, string> = {
  "AI/ML": "hsl(168, 70%, 42%)",
  Cybersecurity: "hsl(200, 70%, 52%)",
  "Web Dev": "hsl(262, 60%, 60%)",
  Basketball: "hsl(28, 80%, 56%)",
  Design: "hsl(330, 70%, 58%)",
  Business: "hsl(142, 60%, 46%)",
  "Data Science": "hsl(190, 65%, 48%)",
  "Creative Writing": "hsl(0, 70%, 56%)",
};