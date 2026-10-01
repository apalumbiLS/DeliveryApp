import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { AppShell } from "@/components/app/app-shell";
import { NotAvailable } from "@/components/app/not-available";
import { Card } from "@/components/ui/card";
import { isAdminConfigured } from "@/lib/admin/config";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

type ProfileRow = {
  role: "dispatcher" | "driver" | "customer";
  full_name: string | null;
  active: boolean;
};

/**
 * The admin console guard.
 *
 * "Admin" is not a role — dispatchers hold administrative permissions, so this
 * is gated on `dispatcher`. As with the portal, this is a UX affordance: RLS is
 * the boundary, and every privileged action re-checks the caller with
 * `requireAdmin()` rather than trusting that this layout ran.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center bg-card-muted px-5 py-10">
        <Card className="w-full max-w-sm p-6">
          <h1 className="text-[17px] font-semibold tracking-tight text-ink">
            Admin unavailable
          </h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
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
    .select("role, full_name, active")
    .eq("id", userId)
    .single();

  const profile = profileData as unknown as ProfileRow | null;

  if (!profile || !profile.active) {
    return <NotAvailable role={profile?.role ?? "unknown"} />;
  }

  // A customer belongs in the portal; a driver has no console yet.
  if (profile.role === "customer") redirect("/portal");
  if (profile.role !== "dispatcher") {
    return <NotAvailable role={profile.role} />;
  }

  return (
    <AppShell
      title="Dispatch"
      subtitle={profile.full_name ?? "Admin console"}
      nav={<AdminNav />}
    >
      {isAdminConfigured() ? (
        children
      ) : (
        <Card className="p-6">
          <h2 className="text-[13px] font-medium text-ink">
            The secret key is not set
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
            Creating and listing accounts needs <code>SUPABASE_SECRET_KEY</code>{" "}
            in <code>web/.env.local</code>. It is server-only — never prefix it
            with <code>NEXT_PUBLIC_</code>.
          </p>
        </Card>
      )}
    </AppShell>
  );
}
