import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Secret-key client. **Bypasses RLS entirely.**
 *
 * Used by exactly two kinds of caller: `auth.admin.*`, and webhook route
 * handlers, which have no user session for RLS to scope to. `auth.users` is not reachable
 * through PostgREST, so creating a user and reading their email both require
 * this key. Everything else — every `profiles` read and write — goes through
 * the RLS-scoped client in `lib/supabase/server.ts`, where the database decides
 * what the caller may do.
 *
 * Call sites are enumerated in
 * docs/architecture/10-auth-and-permissions.md#service-role-usage. Every one of
 * user-initiated one verifies the caller's role first: RLS will not do it here.
 * A webhook handler has no role to check, because it has no user — its
 * authentication is the provider's signature, verified before anything runs.
 *
 * This module must never be imported by a client component, and callers in a
 * route group should reach it through `lib/admin/*` rather than directly.
 */
export function createAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient() must never run in the browser — it carries the secret key.",
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase admin is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in web/.env.local. The secret key is server-only and must never be prefixed NEXT_PUBLIC_.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
