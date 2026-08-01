// ============================================================================
// GET  /api/profile — the caller's profile + primary aspiration
// POST /api/profile — create/update the profile (onboarding completion)
// ----------------------------------------------------------------------------
// Thin: authenticate, delegate to a service, return JSON. All domain logic lives
// in lib/services/*. Every query runs as the caller under RLS, so a user can
// only ever read or write their own row.
// ============================================================================

import { fail, json, loadUserProfile, resolveContext } from "@/lib/server/context";
import { upsertProfile } from "@/lib/services/profile";
import { createAspiration } from "@/lib/services/aspiration";
import { ALL_CATEGORIES, ALL_FORMATS, type Category } from "@/lib/taxonomy";
import type { Difficulty, LearningStyle } from "@/lib/taxonomy";

const DIFFICULTIES: Difficulty[] = ["Beginner", "Intermediate", "Advanced"];
const DAILY_TIMES = [15, 30, 60];

export async function GET(req: Request) {
  const ctx = await resolveContext(req);
  if ("response" in ctx) return ctx.response;

  try {
    const loaded = await loadUserProfile(ctx.supabase, ctx.userId);
    if (!loaded) return fail("No profile yet. Complete onboarding first.", 404);
    return json({ profile: loaded.profile, aspirationId: loaded.aspirationId });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to load profile.", 500);
  }
}

/**
 * Body mirrors what the onboarding flow already collects:
 *   { aspiration, interests[], experience, learningStyle, dailyTime }
 * Profile parameters and the aspiration are written together because onboarding
 * produces them in one step and neither is useful alone.
 */
export async function POST(req: Request) {
  const ctx = await resolveContext(req);
  if ("response" in ctx) return ctx.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const {
    aspiration,
    interests,
    experience,
    learningStyle,
    dailyTime,
  } = (body ?? {}) as Record<string, unknown>;

  // Validate against the same closed unions the engine uses — the API is the
  // boundary where untrusted input becomes typed domain data.
  if (typeof aspiration !== "string" || aspiration.trim().length === 0) {
    return fail("`aspiration` must be a non-empty string.", 400);
  }
  if (
    !Array.isArray(interests) ||
    interests.length === 0 ||
    !interests.every(
      (i): i is Category => typeof i === "string" && (ALL_CATEGORIES as string[]).includes(i)
    )
  ) {
    return fail("`interests` must be a non-empty array of known categories.", 400);
  }
  if (typeof experience !== "string" || !DIFFICULTIES.includes(experience as Difficulty)) {
    return fail("`experience` must be Beginner, Intermediate, or Advanced.", 400);
  }
  if (
    typeof learningStyle !== "string" ||
    !(ALL_FORMATS as string[]).includes(learningStyle)
  ) {
    return fail("`learningStyle` must be one of project, read, video, bite.", 400);
  }
  if (typeof dailyTime !== "number" || !DAILY_TIMES.includes(dailyTime)) {
    return fail("`dailyTime` must be 15, 30, or 60.", 400);
  }

  try {
    const profile = await upsertProfile(ctx.supabase, ctx.userId, {
      experience: experience as Difficulty,
      learningStyle: learningStyle as LearningStyle,
      dailyTime: dailyTime as 15 | 30 | 60,
    });
    const created = await createAspiration(
      ctx.supabase,
      ctx.userId,
      aspiration.trim(),
      interests
    );
    return json({ profile, aspiration: created }, 201);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to save profile.", 500);
  }
}
