"use client";

// ============================================================================
// Engine persistence adapter — the optional bridge to Supabase.
// ----------------------------------------------------------------------------
// This hook is the ONLY thing that connects the in-memory engine to the
// backend, and it is designed so that when Supabase is not configured it does
// nothing at all — every method resolves to a harmless no-op and the app runs
// exactly as it does today (pure client-side engine, nothing persisted).
//
// It talks to Supabase through the SAME service functions the API routes use
// (lib/services/*), via the browser client, so there is one code path for
// reads/writes and RLS scopes everything to the anonymous user. It never
// throws into the UI: persistence is best-effort and failure silently degrades
// to offline behaviour.
//
// What it does when configured:
//   • establishes an anonymous session on mount (getUserId)
//   • persistProfile()  — writes the profile + primary aspiration at onboarding
//   • persistSwipe()    — mirrors each swipe to the interactions timeline
//   • persistCompletion() — records that accepted content was finished
//   • loadHistory()     — replays stored interactions to rehydrate on return
//
// Belief state and insights are NOT fetched or stored here — they are pure
// functions of the history the client already holds, computed by the engine.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ensureAnonymousSession,
  getSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { upsertProfile } from "@/lib/services/profile";
import { createAspiration, getPrimaryAspiration } from "@/lib/services/aspiration";
import {
  getSwipeHistory,
  recordCompletion,
  recordSwipe,
} from "@/lib/services/interaction";
import type {
  Category,
  Interaction,
  Recommendation,
  SwipeDirection,
  UserProfile,
} from "@/lib/taxonomy";

export interface EnginePersistence {
  /** True once an anonymous session exists and writes are possible. */
  ready: boolean;
  /** Whether persistence is even enabled (env-gated). Useful for the UI. */
  enabled: boolean;
  persistProfile: (profile: UserProfile) => void;
  persistSwipe: (
    card: Recommendation,
    direction: SwipeDirection,
    profile: UserProfile,
    timeToSwipeMs?: number
  ) => void;
  persistCompletion: (
    card: Recommendation,
    profile: UserProfile,
    completionTimeMs?: number
  ) => void;
  /** Replay stored interactions, or [] when unconfigured / empty / offline. */
  loadHistory: () => Promise<Interaction[]>;
}

export function useEnginePersistence(): EnginePersistence {
  const [userId, setUserId] = useState<string | null>(null);
  // The primary aspiration id, cached after profile persistence so each swipe
  // row can be attributed to the goal it happened under.
  const aspirationId = useRef<string | null>(null);

  // Establish the anonymous session once, on mount. No-op when unconfigured.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    ensureAnonymousSession().then((id) => {
      if (cancelled || !id) return;
      setUserId(id);
      // Warm the cached aspiration id for returning users.
      const supabase = getSupabaseClient();
      if (supabase) {
        getPrimaryAspiration(supabase, id)
          .then((a) => {
            if (!cancelled && a) aspirationId.current = a.id;
          })
          .catch(() => {
            /* best-effort */
          });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persistProfile = useCallback(
    (profile: UserProfile) => {
      const supabase = getSupabaseClient();
      if (!supabase || !userId) return;
      // Fire-and-forget: upsert the profile, then ensure a primary aspiration.
      void (async () => {
        try {
          await upsertProfile(supabase, userId, {
            experience: profile.experience,
            learningStyle: profile.learningStyle,
            dailyTime: profile.dailyTime,
          });
          const existing = await getPrimaryAspiration(supabase, userId);
          if (existing) {
            aspirationId.current = existing.id;
          } else {
            const created = await createAspiration(
              supabase,
              userId,
              profile.aspiration,
              profile.interests as Category[]
            );
            aspirationId.current = created.id;
          }
        } catch {
          /* best-effort; UI already updated from the in-memory engine */
        }
      })();
    },
    [userId]
  );

  const persistSwipe = useCallback(
    (
      card: Recommendation,
      direction: SwipeDirection,
      profile: UserProfile,
      timeToSwipeMs?: number
    ) => {
      const supabase = getSupabaseClient();
      if (!supabase || !userId) return;
      void recordSwipe(supabase, {
        profileId: userId,
        aspirationId: aspirationId.current,
        card,
        profile,
        direction,
        timeToSwipeMs: timeToSwipeMs ?? null,
      }).catch(() => {
        /* best-effort */
      });
    },
    [userId]
  );

  const persistCompletion = useCallback(
    (card: Recommendation, profile: UserProfile, completionTimeMs?: number) => {
      const supabase = getSupabaseClient();
      if (!supabase || !userId) return;
      void recordCompletion(supabase, {
        profileId: userId,
        aspirationId: aspirationId.current,
        card,
        profile,
        completionTimeMs: completionTimeMs ?? null,
      }).catch(() => {
        /* best-effort */
      });
    },
    [userId]
  );

  const loadHistory = useCallback(async (): Promise<Interaction[]> => {
    const supabase = getSupabaseClient();
    if (!supabase || !userId) return [];
    try {
      return await getSwipeHistory(supabase, userId);
    } catch {
      return [];
    }
  }, [userId]);

  return {
    ready: Boolean(userId),
    enabled: isSupabaseConfigured,
    persistProfile,
    persistSwipe,
    persistCompletion,
    loadHistory,
  };
}
