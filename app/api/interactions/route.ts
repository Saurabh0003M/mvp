// ============================================================================
// /api/interactions
// ---------------------------------------------------------------------------
// GET  — the caller's swipe history in replay order (chronological).
// POST — record one swipe, or one completion.
//
// This is the only write path that matters. Everything the product shows about
// a user (taste weights, cognitive state, friction, insights) is derived from
// these rows, so this route is the backend's single source of truth.
//
// The client sends a content slug, not a whole card: the server resolves the
// card from the corpus so the denormalized snapshot on the row can't be forged
// or drift out of sync with what we actually recommended.
// ============================================================================

import { LIVE_CORPUS } from "@/lib/engine";
import { fail, json, loadEngineInputs, resolveContext } from "@/lib/server/context";
import { recordCompletion, recordSwipe } from "@/lib/services/interaction";
import type { SwipeDirection } from "@/lib/taxonomy";

const DIRECTIONS: SwipeDirection[] = ["accept", "skip", "later"];

function isDirection(value: unknown): value is SwipeDirection {
  return typeof value === "string" && (DIRECTIONS as string[]).includes(value);
}

/** Optional non-negative millisecond duration. `undefined` → null, junk → invalid. */
function readDuration(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value);
}

export async function GET(req: Request) {
  const ctx = await resolveContext(req);
  if ("response" in ctx) return ctx.response;

  try {
    const inputs = await loadEngineInputs(ctx.supabase, ctx.userId);
    if (!inputs) return fail("No profile yet. Complete onboarding first.", 404);
    return json({ interactions: inputs.history });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to load interactions.", 500);
  }
}

export async function POST(req: Request) {
  const ctx = await resolveContext(req);
  if ("response" in ctx) return ctx.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const slug = body.contentSlug ?? body.recommendationId;
  if (typeof slug !== "string" || !slug) {
    return fail("`contentSlug` is required.", 400);
  }

  const card = LIVE_CORPUS.find((r) => r.id === slug);
  if (!card) return fail(`Unknown content slug: ${slug}`, 400);

  // `completed` is a distinct verb, not a swipe direction — it arrives as its
  // own row after the user actually finished accepted content.
  const isCompletion = body.action === "completed" || body.completed === true;

  if (!isCompletion && !isDirection(body.direction)) {
    return fail("`direction` must be one of: accept, skip, later.", 400);
  }

  try {
    const inputs = await loadEngineInputs(ctx.supabase, ctx.userId);
    if (!inputs) return fail("No profile yet. Complete onboarding first.", 404);

    if (isCompletion) {
      const completionTimeMs = readDuration(body.completionTimeMs);
      if (completionTimeMs === undefined) {
        return fail("`completionTimeMs` must be a non-negative number.", 400);
      }

      const row = await recordCompletion(ctx.supabase, {
        profileId: ctx.userId,
        aspirationId: inputs.aspirationId,
        card,
        profile: inputs.profile,
        completionTimeMs,
      });
      return json({ interaction: row }, 201);
    }

    const timeToSwipeMs = readDuration(body.timeToSwipeMs);
    if (timeToSwipeMs === undefined) {
      return fail("`timeToSwipeMs` must be a non-negative number.", 400);
    }

    const row = await recordSwipe(ctx.supabase, {
      profileId: ctx.userId,
      aspirationId: inputs.aspirationId,
      card,
      profile: inputs.profile,
      direction: body.direction as SwipeDirection,
      timeToSwipeMs,
    });
    return json({ interaction: row }, 201);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to record interaction.", 500);
  }
}
