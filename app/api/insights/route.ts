// ============================================================================
// GET /api/insights?dismissed=<id>&applied=<id>
// ---------------------------------------------------------------------------
// The single most relevant insight for the user right now, or null.
//
// Also computed rather than stored. The one thing that genuinely can't be
// derived from behaviour is which insights the user has already dismissed or
// applied — those are decisions, not observations — so they come in as repeated
// query params rather than being assumed empty. The frontend already tracks
// them in engine state; this keeps the server stateless without lying about it.
// ============================================================================

import { fail, json, loadEngineInputs, resolveContext } from "@/lib/server/context";
import { computeInsight } from "@/lib/server/insightEngine";

export async function GET(req: Request) {
  const ctx = await resolveContext(req);
  if ("response" in ctx) return ctx.response;

  try {
    const inputs = await loadEngineInputs(ctx.supabase, ctx.userId);
    if (!inputs) return fail("No profile yet. Complete onboarding first.", 404);

    const params = new URL(req.url).searchParams;
    const result = computeInsight(inputs.profile, inputs.history, {
      dismissed: params.getAll("dismissed"),
      applied: params.getAll("applied"),
    });

    return json({
      insight: result.insight,
      friction: {
        active: result.friction.active,
        topics: result.friction.topics,
      },
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to compute insight.", 500);
  }
}
