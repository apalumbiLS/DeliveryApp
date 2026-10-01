import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client, on the publishable key.
 *
 * `createBrowserClient` is a singleton internally, so calling this from several
 * components still yields one client. The session lives in cookies — the same
 * `sb-<ref>-auth-token` cookie the server reads — so sign-in here is visible to
 * Server Components on the next request.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Copy web/.env.example to web/.env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return createBrowserClient(url, key);
}
