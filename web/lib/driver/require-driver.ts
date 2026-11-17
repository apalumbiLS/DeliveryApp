import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type DriverAppContext = {
  /** RLS-scoped client for the verified caller. */
  supabase: SupabaseClient;
  userId: string;
  /**
   * A dispatcher may open the driver app to see a job as its link shows it,
   * but only a driver can accept or advance one.
   */
  role: "driver" | "dispatcher";
  fullName: string | null;
};

/**
 * The gate in front of every driver-app read and mutation.
 *
 * Mirrors `lib/dispatch/require-dispatcher.ts`: a server action can be invoked
 * directly, so it re-establishes who is calling rather than trusting that the
 * layout ran. The role comes from `profiles`, never from the request. The
 * database functions check the caller again.
 */
export async function requireDriverApp(): Promise<DriverAppContext> {
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

  if (
    !row ||
    !row.active ||
    (row.role !== "driver" && row.role !== "dispatcher")
  ) {
    redirect("/");
  }

  return {
    supabase,
    userId,
    role: row.role as "driver" | "dispatcher",
    fullName: row.full_name,
  };
}
