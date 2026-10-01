import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type AdminContext = {
  /** RLS-scoped client for the verified dispatcher. Use this for profile writes. */
  supabase: SupabaseClient;
  userId: string;
  fullName: string | null;
};

/**
 * The gate in front of every privileged path.
 *
 * RLS is the boundary for data, but the secret-key client bypasses RLS
 * entirely, so any action that touches it has to establish who is calling
 * first. This reads the role from `profiles` — never from a client-supplied
 * value — and refuses anything that is not an active dispatcher.
 */
export async function requireAdmin(): Promise<AdminContext> {
  if (!isSupabaseConfigured()) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, active")
    .eq("id", userId)
    .single();

  const row = profile as unknown as {
    role: string;
    full_name: string | null;
    active: boolean;
  } | null;

  if (!row || row.role !== "dispatcher" || !row.active) redirect("/portal");

  return { supabase, userId, fullName: row.full_name };
}
