import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { USER_ROLES, type UserRole } from "@/lib/tokens";

export type Company = { id: string; name: string };

export type DirectoryUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: UserRole | null;
  active: boolean | null;
  companyId: string | null;
  companyName: string | null;
  createdAt: string | null;
};

export type CreateUserInput = {
  email: string;
  password: string;
  role: UserRole;
  companyId: string | null;
  fullName: string | null;
};

/** Every company, for the assignment picker. Dispatchers may read all of them. */
export async function listCompanies(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .order("name");

  if (error) throw new Error(error.message);

  return (data ?? []) as unknown as Company[];
}

/**
 * The directory: auth users (for emails) joined to their `profiles` row.
 *
 * `auth.users` is not exposed through PostgREST, so the emails come from the
 * admin API while the role, company, and active state come from `profiles`
 * through the dispatcher's own session. A user with no profile row is possible
 * — provisioning is two steps — so it is surfaced rather than hidden.
 */
export async function listDirectory(
  supabase: SupabaseClient,
): Promise<DirectoryUser[]> {
  const admin = createAdminClient();

  const accounts: {
    id: string;
    email: string | null;
    createdAt: string | null;
  }[] = [];
  const perPage = 200;

  // listUsers is paginated; page through it rather than silently truncating.
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw new Error(error.message);

    for (const user of data.users) {
      accounts.push({
        id: user.id,
        email: user.email ?? null,
        createdAt: user.created_at ?? null,
      });
    }

    if (data.users.length < perPage) break;
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, full_name, active, company_id, companies (name)");

  if (profileError) throw new Error(profileError.message);

  const profiles = (profileData ?? []) as unknown as {
    id: string;
    role: UserRole;
    full_name: string | null;
    active: boolean;
    company_id: string | null;
    companies: { name: string } | null;
  }[];

  const byId = new Map(profiles.map((profile) => [profile.id, profile]));

  return accounts
    .map((account) => {
      const profile = byId.get(account.id);
      return {
        id: account.id,
        email: account.email,
        fullName: profile?.full_name ?? null,
        role: profile?.role ?? null,
        active: profile?.active ?? null,
        companyId: profile?.company_id ?? null,
        companyName: profile?.companies?.name ?? null,
        createdAt: account.createdAt,
      };
    })
    .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
}

export type CreateUserResult =
  { ok: true; userId: string } | { ok: false; error: string };

/**
 * Create an auth user, then their `profiles` row.
 *
 * These are two systems, so there is no transaction to lean on. If the profile
 * insert fails — a bad company id, the customer/company check — the auth user
 * is deleted again, because an account with no profile can do nothing and would
 * not even appear in this directory.
 */
export async function createPortalUser(
  supabase: SupabaseClient,
  input: CreateUserInput,
): Promise<CreateUserResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    // Self-signup is off, so nothing would send a confirmation email. Confirm
    // on the dispatcher's behalf, the same as "Auto Confirm User" in the
    // dashboard.
    email_confirm: true,
  });

  if (error || !data.user) {
    return {
      ok: false,
      error: error?.message ?? "Could not create the account.",
    };
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    role: input.role,
    company_id: input.companyId,
    full_name: input.fullName,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return {
      ok: false,
      error: `Could not create the profile: ${profileError.message}`,
    };
  }

  return { ok: true, userId: data.user.id };
}

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}
