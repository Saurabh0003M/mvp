// ============================================================================
// Aspiration service — "who you're trying to become".
// ----------------------------------------------------------------------------
// A user may hold several aspirations over time; exactly one is `is_primary`,
// and that is the one the current frontend renders ("Becoming <aspiration>")
// and scores against. Keeping them as rows rather than a column on `profiles`
// means goal history is preserved for free, and multi-goal support later needs
// no migration.
//
// The aspiration also carries `interests` (the categories chosen at onboarding)
// because those interests ARE the goal set — the boundary the friction layer
// must never cross when it lowers difficulty.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AspirationRow, Database } from "../supabase/types";
import type { Category } from "../taxonomy";

type Client = SupabaseClient<Database>;

export interface AspirationRecord {
  id: string;
  title: string;
  interests: Category[];
  isPrimary: boolean;
  createdAt: string;
}

function toRecord(row: AspirationRow): AspirationRecord {
  return {
    id: row.id,
    title: row.title,
    interests: (row.interests ?? []) as Category[],
    isPrimary: row.is_primary,
    createdAt: row.created_at,
  };
}

/** All aspirations for a user, primary first then newest. */
export async function listAspirations(
  supabase: Client,
  profileId: string
): Promise<AspirationRecord[]> {
  const { data, error } = await supabase
    .from("aspirations")
    .select("*")
    .eq("profile_id", profileId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listAspirations failed: ${error.message}`);
  return (data ?? []).map(toRecord);
}

/** The single aspiration the frontend is currently oriented around. */
export async function getPrimaryAspiration(
  supabase: Client,
  profileId: string
): Promise<AspirationRecord | null> {
  const { data, error } = await supabase
    .from("aspirations")
    .select("*")
    .eq("profile_id", profileId)
    .eq("is_primary", true)
    .maybeSingle();

  if (error) throw new Error(`getPrimaryAspiration failed: ${error.message}`);
  return data ? toRecord(data) : null;
}

/**
 * Add an aspiration. When `makePrimary` is true (the default for onboarding),
 * any existing primary is demoted first so the "exactly one primary" invariant
 * holds. Two statements rather than a transaction — acceptable here because the
 * worst case is a transient second primary, and `getPrimaryAspiration` uses
 * maybeSingle ordering that still resolves deterministically.
 */
export async function createAspiration(
  supabase: Client,
  profileId: string,
  title: string,
  interests: Category[],
  makePrimary = true
): Promise<AspirationRecord> {
  if (makePrimary) {
    const { error: demoteError } = await supabase
      .from("aspirations")
      .update({ is_primary: false })
      .eq("profile_id", profileId)
      .eq("is_primary", true);
    if (demoteError) {
      throw new Error(`createAspiration (demote) failed: ${demoteError.message}`);
    }
  }

  const { data, error } = await supabase
    .from("aspirations")
    .insert({
      profile_id: profileId,
      title,
      interests,
      is_primary: makePrimary,
    })
    .select("*")
    .single();

  if (error) throw new Error(`createAspiration failed: ${error.message}`);
  return toRecord(data);
}

/** Promote an existing aspiration to primary (multi-goal switching, future UI). */
export async function setPrimaryAspiration(
  supabase: Client,
  profileId: string,
  aspirationId: string
): Promise<void> {
  const { error: demoteError } = await supabase
    .from("aspirations")
    .update({ is_primary: false })
    .eq("profile_id", profileId)
    .eq("is_primary", true);
  if (demoteError) throw new Error(`setPrimaryAspiration (demote) failed: ${demoteError.message}`);

  const { error } = await supabase
    .from("aspirations")
    .update({ is_primary: true })
    .eq("id", aspirationId)
    .eq("profile_id", profileId);
  if (error) throw new Error(`setPrimaryAspiration failed: ${error.message}`);
}
