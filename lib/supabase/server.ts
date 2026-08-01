// ============================================================================
// Server Supabase client — for Route Handlers (app/api/*).
// ----------------------------------------------------------------------------
// Two factories:
//
//  - getServerClientFromRequest(req): builds a request-scoped client that
//    forwards the caller's bearer token, so RLS runs as the signed-in
//    (anonymous) user. This is what the API routes use — every query is scoped
//    to that user's own rows by policy, no service-role key involved.
//
//  - getServiceClient(): a privileged client using the service-role key, used
//    only for trusted server-side work like seeding the content corpus. Never
//    expose this to the browser.
//
// Both return null when the corresponding env vars are absent, matching the
// env-gated, degrade-gracefully contract of the browser client.
// ============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isServerSupabaseConfigured = Boolean(url && anonKey);

/**
 * Request-scoped client that runs as the caller. Reads the `Authorization`
 * header (Bearer <access_token>) the browser client sends, so RLS applies.
 * Returns null when unconfigured.
 */
export function getServerClientFromRequest(
  req: Request
): SupabaseClient<Database> | null {
  if (!isServerSupabaseConfigured) return null;
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient<Database>(url!, anonKey!, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Privileged service-role client. Bypasses RLS — use ONLY for trusted tasks
 * such as seeding content. Returns null if the service-role key is absent.
 */
export function getServiceClient(): SupabaseClient<Database> | null {
  if (!url || !serviceRoleKey) return null;
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
