// ============================================================================
// GET /api/belief
// ---------------------------------------------------------------------------
// The user's current belief state: taste weights, counters, compressed
// cognitive state, trajectory, and friction.
//
// COMPUTED, NEVER STORED. There is no belief_state table — this is a pure
// function of (profile, ordered interactions) replayed through the real engine,
// so the API and the client can never disagree about what the user looks like.
// ============================================================================

import { computeBeliefState } from "@/lib/server/beliefEngine";
import { fail, json, loadEngineInputs, resolveContext } from "@/lib/server/context";

export async function GET(req: Request) {
  const ctx = await resolveContext(req);
  if ("response" in ctx) return ctx.response;

  try {
    const inputs = await loadEngineInputs(ctx.supabase, ctx.userId);
    if (!inputs) return fail("No profile yet. Complete onboarding first.", 404);

    const belief = computeBeliefState(inputs.profile, inputs.history);
    return json({ belief });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to compute belief state.", 500);
  }
}
