import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Whether the Supabase environment is present. Pages use this to render a
 * useful notice instead of throwing when a developer hasn't copied
 * `.env.example` to `.env.local` yet.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/**
 * Server-side Supabase client, on the publishable key.
 *
 * Row Level Security applies to everything read or written through this client:
 * the publishable key carries no privileges of its own, so the database decides
 * what the caller may see. Anything that must bypass RLS belongs in
 * `lib/supabase/admin.ts` on the secret key, which is restricted to three
 * enumerated call sites — see
 * docs/architecture/10-auth-and-permissions.md#service-role-usage.
 *
 * The session lives in the `sb-<ref>-auth-token` cookie, so this client sees
 * whoever is signed in. A fresh client is created per request: it reads the
 * request's cookies, and a client shared across requests would carry one user's
 * session into another's response.
 *
 * Server Components cannot write cookies, so the `setAll` write is best-effort
 * here. `proxy.ts` refreshes the token on every request and writes the rotated
 * cookies onto the response; that is what keeps the session alive.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Copy web/.env.example to web/.env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // proxy owns the write path, so there is nothing to recover here.
        }
      },
    },
  });
}
