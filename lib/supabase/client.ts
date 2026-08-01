// ============================================================================
// Browser Supabase client — anonymous-auth, env-gated.
// ----------------------------------------------------------------------------
// The whole persistence layer is OPTIONAL. If NEXT_PUBLIC_SUPABASE_URL /
// _ANON_KEY are not set, `getSupabaseClient()` returns null and every caller is
// written to no-op, so the app behaves EXACTLY as it does today (pure
// client-side engine, nothing persisted). This is what guarantees the demo
// can't break and lets mock data be replaced gradually.
//
// When configured, we use Supabase ANONYMOUS sign-in: a real auth.users row is
// created silently on first load, so Row Level Security works normally and
// there is no login UI — the frontend UX is untouched. The anonymous user can
// later be upgraded to email/password without losing data.
// ============================================================================

"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when Supabase env vars are present. Callers gate on this. */
export const isSupabaseConfigured = Boolean(url && anonKey);

// Singleton — one client per browser tab. Created lazily so importing this
// module in an unconfigured environment is a harmless no-op.
let client: SupabaseClient<Database> | null = null;

/**
 * Get the browser Supabase client, or null when persistence is disabled.
 * Safe to call anywhere; returns the same instance every time.
 */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured) return null;
  if (client) return client;
  client = createClient<Database>(url!, anonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // No email flow — the session is established via anonymous sign-in below.
      detectSessionInUrl: false,
    },
  });
  return client;
}

/**
 * Ensure there is an authenticated (anonymous) session and return its user id.
 * Idempotent: reuses an existing session, only signs in anonymously the first
 * time. Returns null if persistence is disabled or sign-in fails (callers then
 * fall back to the in-memory engine, so failure is never fatal).
 */
export async function ensureAnonymousSession(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: existing } = await supabase.auth.getSession();
  if (existing.session?.user) return existing.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    // Anonymous sign-in can be disabled in the Supabase dashboard. Degrade
    // gracefully to the offline engine rather than throwing.
    console.warn("[supabase] anonymous sign-in unavailable; running offline.", error?.message);
    return null;
  }
  return data.user.id;
}
