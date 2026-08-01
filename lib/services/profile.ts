// ============================================================================
// Profile service — the user's stated learning parameters.
// ----------------------------------------------------------------------------
// A profile row holds only what the user TOLD us and what cannot be derived:
// experience level, learning style, daily time budget. The aspiration and
// interests live in `aspirations` (a user may have several; one is primary).
//
// Every service in this folder follows the same contract:
//   - takes an explicit SupabaseClient so it works from the browser, a Route
//     Handler, or a test without hidden globals;
//   - returns plain domain objects, never raw rows;
//   - throws on a real database error so callers can decide (the persistence
//     adapter swallows and degrades to the offline engine).
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ProfileRow,
} from "../supabase/types";
import type { Difficulty, LearningStyle, UserProfile } from "../taxonomy";

type Client = SupabaseClient<Database>;

/** The persisted half of a UserProfile (aspiration/interests come separately). */
export interface ProfileRecord {
  id: string;
  experience: Difficulty;
  learningStyle: LearningStyle;
  dailyTime: 15 | 30 | 60;
}

function toRecord(row: ProfileRow): ProfileRecord {
  return {
    id: row.id,
    experience: row.experience as Difficulty,
    learningStyle: row.learning_style as LearningStyle,
    dailyTime: row.daily_time as 15 | 30 | 60,
  };
}

/** Read a profile by id. Returns null when it does not exist yet. */
export async function getProfile(
  supabase: Client,
  userId: string
): Promise<ProfileRecord | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`getProfile failed: ${error.message}`);
  return data ? toRecord(data) : null;
}

/**
 * Create or update the profile row for this user. Called at the end of
 * onboarding and whenever the user changes a stated parameter.
 */
export async function upsertProfile(
  supabase: Client,
  userId: string,
  profile: Pick<UserProfile, "experience" | "learningStyle" | "dailyTime">
): Promise<ProfileRecord> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        experience: profile.experience,
        learning_style: profile.learningStyle,
        daily_time: profile.dailyTime,
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (error) throw new Error(`upsertProfile failed: ${error.message}`);
  return toRecord(data);
}
