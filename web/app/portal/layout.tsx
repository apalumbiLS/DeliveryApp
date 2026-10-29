import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { NotAvailable } from "@/components/app/not-available";
import { PortalNav } from "@/components/portal/portal-nav";
import { Card } from "@/components/ui/card";
import { APP_NAME } from "@/lib/brand";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

type ProfileRow = {
  role: "dispatcher" | "driver" | "customer";
  full_name: string | null;
  active: boolean;
  companies: { name: string } | null;
};

/**
 * The customer portal guard.
 *
 * This is a UX affordance, not the security boundary — RLS is (see
 * docs/architecture/10-auth-and-permissions.md). It exists so a signed-out or
 * wrong-role visitor gets a sensible screen instead of an empty one. Pages
 * below may assume a configured Supabase project and a customer session.
 */
export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center bg-card-muted px-5 py-10">
        <Card className="w-full max-w-sm p-6">
          <h1 className="text-[18px] font-semibold tracking-tight text-ink">
            Portal unavailable
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
            Supabase is not configured. Copy <code>web/.env.example</code> to{" "}
            <code>web/.env.local</code> and set{" "}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>.
          </p>
        </Card>
      </main>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, full_name, active, companies (name)")
    .eq("id", userId)
    .single();

  // profiles.company_id -> companies.id is many-to-one, so PostgREST returns a
  // single object even though supabase-js infers an array without generated
  // types. The cast goes away once the schema types are generated.
  const profile = profileData as unknown as ProfileRow | null;

  if (!profile || !profile.active) {
    return <NotAvailable role={profile?.role ?? "unknown"} />;
  }

  // A dispatcher belongs in the admin console, not the customer portal.
  if (profile.role === "dispatcher") redirect("/admin");

  if (profile.role !== "customer") {
    return <NotAvailable role={profile.role} />;
  }

  const companyName = profile.companies?.name ?? null;

  return (
    <AppShell
      title={companyName ?? APP_NAME}
      subtitle={companyName ? APP_NAME : "Customer portal"}
      nav={<PortalNav />}
    >
      {children}
    </AppShell>
  );
}
