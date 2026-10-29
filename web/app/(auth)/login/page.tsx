import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { homeForRole } from "@/lib/auth/home";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/tokens";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  if (!isSupabaseConfigured()) {
    return (
      <Card className="p-6">
        <h1 className="text-[18px] font-semibold tracking-tight text-ink">
          Sign in
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
          Supabase is not configured. Copy <code>web/.env.example</code> to{" "}
          <code>web/.env.local</code> and set{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>.
        </p>
      </Card>
    );
  }

  // Authoritative: someone already signed in should not see the form, and
  // should land on their own console. The proxy deliberately leaves /login
  // alone — it cannot know the role without a query, and the page can.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", userId)
      .single();

    const row = profile as unknown as {
      role: UserRole;
      active: boolean;
    } | null;

    redirect(homeForRole(row?.role, row?.active));
  }

  return (
    <Card className="p-6">
      <h1 className="text-[18px] font-semibold tracking-tight text-ink">
        Sign in
      </h1>

      <div className="mt-5">
        <LoginForm next={next} />
      </div>

      <p className="mt-5 border-t border-hairline-soft pt-4 text-[13.5px] leading-relaxed text-ink-muted">
        No account yet?{" "}
        <Link
          href="/request-access"
          className="font-medium text-accent transition-colors hover:text-accent-hover"
        >
          Request access
        </Link>
      </p>
    </Card>
  );
}
