"use server";

import { redirect } from "next/navigation";

import { homeForRole } from "@/lib/auth/home";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/tokens";

export type LoginState = { error: string } | undefined;

/**
 * Sign in with email + password.
 *
 * Self-signup is disabled (ADR-0007): accounts are provisioned by a dispatcher,
 * so this only ever authenticates an existing user.
 */
export async function signIn(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Sign-in isn't available — this environment has no Supabase project configured.",
    };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    // Deliberately generic: never reveal whether an email is registered.
    return { error: "That email and password don't match." };
  }

  // Route by role rather than always to the portal: a dispatcher belongs in
  // the admin console. `next` wins when the visitor was deep-linked here.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", data.user.id)
    .single();

  const row = profile as unknown as {
    role: UserRole;
    active: boolean;
  } | null;

  redirect(next ?? homeForRole(row?.role, row?.active));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Only same-origin absolute paths — an unchecked `next` is an open redirect. */
function safeNext(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}
