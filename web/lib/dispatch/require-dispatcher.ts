import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type DispatcherContext = {
  /** RLS-scoped client for the verified dispatcher. */
  supabase: SupabaseClient;
  userId: string;
  fullName: string | null;
};

/**
 * The gate in front of every dispatcher-side read and mutation.
 *
 * The `/dispatch` layout already checks this for rendering, but a server action
 * can be invoked directly, so it re-establishes who is calling rather than
 * trusting that the layout ran. The role comes from `profiles`, never from the
 * request.
 *
 * Mirrors `lib/portal/require-customer.ts`. Note the role is `dispatcher` —
 * "admin" is a permission set, not a role.
 */
export async function requireDispatcher(): Promise<DispatcherContext> {
  if (!isSupabaseConfigured()) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active, full_name")
    .eq("id", userId)
    .single();

  const row = profile as unknown as {
    role: string;
    active: boolean;
    full_name: string | null;
  } | null;

  if (!row || !row.active || row.role !== "dispatcher") {
    // A customer belongs in the portal; a driver has no console yet.
    redirect("/");
  }

  return { supabase, userId, fullName: row.full_name };
}
