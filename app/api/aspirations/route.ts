// ============================================================================
// GET  /api/aspirations — list the caller's aspirations (primary first)
// POST /api/aspirations — add an aspiration, optionally making it primary
// ----------------------------------------------------------------------------
// "Who you're trying to become." Exactly one aspiration is primary and that is
// the goal the frontend renders and scores against. The interests attached to an
// aspiration ARE the goal set the friction layer must never cross.
// ============================================================================

import { fail, json, resolveContext } from "@/lib/server/context";
import { createAspiration, listAspirations } from "@/lib/services/aspiration";
import { ALL_CATEGORIES, type Category } from "@/lib/taxonomy";

export async function GET(req: Request) {
  const ctx = await resolveContext(req);
  if ("response" in ctx) return ctx.response;

  try {
    const aspirations = await listAspirations(ctx.supabase, ctx.userId);
    return json({ aspirations });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to load aspirations.", 500);
  }
}

export async function POST(req: Request) {
  const ctx = await resolveContext(req);
  if ("response" in ctx) return ctx.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const { title, interests, makePrimary } = (body ?? {}) as Record<string, unknown>;

  if (typeof title !== "string" || title.trim().length === 0) {
    return fail("`title` must be a non-empty string.", 400);
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

  try {
    const aspiration = await createAspiration(
      ctx.supabase,
      ctx.userId,
      title.trim(),
      interests,
      makePrimary !== false // default true
    );
    return json({ aspiration }, 201);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to create aspiration.", 500);
  }
}
