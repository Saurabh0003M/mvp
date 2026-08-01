// ============================================================================
// GET /api/recommendations?limit=10
// ---------------------------------------------------------------------------
// The next cards to show this user, in display order (relevance + diversity +
// friction). Computed from stored interactions via the recommendation engine.
// ============================================================================

import { fail, json, loadEngineInputs, resolveContext } from "@/lib/server/context";
import { getRecommendations } from "@/lib/server/recommendationEngine";

export async function GET(req: Request) {
  const ctx = await resolveContext(req);
  if ("response" in ctx) return ctx.response;

  try {
    const inputs = await loadEngineInputs(ctx.supabase, ctx.userId);
    if (!inputs) return fail("No profile yet. Complete onboarding first.", 404);

    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));

    const result = getRecommendations(inputs.profile, inputs.history, undefined, limit);

    return json({
      items: result.items,
      tiers: result.tiers,
      friction: {
        active: result.friction.active,
        topics: result.friction.topics,
      },
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to compute recommendations.", 500);
  }
}
