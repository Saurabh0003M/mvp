// ============================================================================
// Request context — the shared preamble for every Route Handler.
// ----------------------------------------------------------------------------
// Each API route needs the same four things before it can do anything useful:
// a Supabase client scoped to the caller, the caller's user id, their profile,
// and their interaction history. Doing that once here keeps the route handlers
// down to a few lines each and guarantees they all behave identically when
// Supabase is unconfigured or the caller is unauthenticated.
//
// Error contract, deliberately boring:
//   503 — Supabase not configured (the app runs fine without it; the API can't)
//   401 — no valid session
//   404 — authenticated but no profile yet (onboarding hasn't completed)
//   400 — malformed request body
//   500 — a database call actually failed
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerClientFromRequest } from "../supabase/server";
import type { Database } from "../supabase/types";
import type { Category, Interaction, UserProfile } from "../taxonomy";
import { getPrimaryAspiration } from "../services/aspiration";
import { getProfile } from "../services/profile";
import { getSwipeHistory } from "../services/interaction";

type Client = SupabaseClient<Database>;

/** JSON response helper — every route replies in the same shape. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Error response helper. */
export function fail(message: string, status: number): Response {
  return json({ error: message }, status);
}

/** Resolved caller identity plus a client that runs as them under RLS. */
export interface RequestContext {
  supabase: Client;
  userId: string;
}

/**
 * Authenticate the request. Returns a context, or a Response to return as-is.
 * Callers do: `const ctx = await resolveContext(req); if ("error" in ctx) ...`
 */
export async function resolveContext(
  req: Request
): Promise<RequestContext | { response: Response }> {
  const supabase = getServerClientFromRequest(req);
  if (!supabase) {
    return {
      response: fail(
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        503
      ),
    };
  }

  // Validates the forwarded bearer token against Supabase Auth.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { response: fail("Unauthorized: missing or invalid session.", 401) };
  }

  return { supabase, userId: data.user.id };
}

/**
 * Assemble the engine's `UserProfile` from its two persisted halves: the
 * profile row (stated parameters) and the primary aspiration (goal + interests).
 * Returns null when either is missing — i.e. onboarding hasn't finished.
 */
export async function loadUserProfile(
  supabase: Client,
  userId: string
): Promise<{ profile: UserProfile; aspirationId: string } | null> {
  const [record, aspiration] = await Promise.all([
    getProfile(supabase, userId),
    getPrimaryAspiration(supabase, userId),
  ]);
  if (!record || !aspiration) return null;

  return {
    profile: {
      aspiration: aspiration.title,
      interests: aspiration.interests as Category[],
      experience: record.experience,
      learningStyle: record.learningStyle,
      dailyTime: record.dailyTime,
    },
    aspirationId: aspiration.id,
  };
}

/**
 * The full derived-state preamble: profile + ordered swipe history. This is
 * everything the compute engines need — no belief or insight rows to load,
 * because there aren't any.
 */
export interface EngineInputs {
  profile: UserProfile;
  aspirationId: string;
  history: Interaction[];
}

export async function loadEngineInputs(
  supabase: Client,
  userId: string
): Promise<EngineInputs | null> {
  const loaded = await loadUserProfile(supabase, userId);
  if (!loaded) return null;
  const history = await getSwipeHistory(supabase, userId);
  return { ...loaded, history };
}
