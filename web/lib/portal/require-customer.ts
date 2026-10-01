import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type CustomerContext = {
  /** RLS-scoped client for the verified customer. */
  supabase: SupabaseClient;
  userId: string;
  companyId: string;
  fullName: string | null;
};

/**
 * The gate in front of every customer-side mutation.
 *
 * The portal layout already checks this for rendering, but a server action can
 * be invoked directly, so it re-establishes who is calling rather than trusting
 * that the layout ran. The role and company come from `profiles`, never from
 * the request.
 */
export async function requireCustomer(): Promise<CustomerContext> {
  if (!isSupabaseConfigured()) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active, company_id, full_name")
    .eq("id", userId)
    .single();

  const row = profile as unknown as {
    role: string;
    active: boolean;
    company_id: string | null;
    full_name: string | null;
  } | null;

  // A customer always has a company — the profiles_customer_company check
  // guarantees it — so a missing one means the row is not what we expect.
  if (!row || !row.active || row.role !== "customer" || !row.company_id) {
    redirect("/portal");
  }

  return {
    supabase,
    userId,
    companyId: row.company_id,
    fullName: row.full_name,
  };
}
