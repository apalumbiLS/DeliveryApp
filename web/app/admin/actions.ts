"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAdminConfigured } from "@/lib/admin/config";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createPortalUser, isUserRole, listCompanies } from "@/lib/admin/users";

export type CreateUserState = { error: string } | undefined;

export async function createUser(
  _previous: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  if (!isAdminConfigured()) {
    return {
      error: "The secret key is not configured, so accounts cannot be created.",
    };
  }

  const { supabase } = await requireAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "");
  const companyId = String(formData.get("companyId") ?? "").trim() || null;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Use a password of at least 8 characters." };
  }
  if (!isUserRole(role)) {
    return { error: "Pick a role." };
  }

  // Mirrors the schema's check: a customer belongs to a company, nothing else
  // does. Checking here means a clean message instead of a constraint error.
  if (role === "customer") {
    const companies = await listCompanies(supabase);
    if (!companyId || !companies.some((company) => company.id === companyId)) {
      return { error: "Pick a company for this customer." };
    }
  }

  const result = await createPortalUser(supabase, {
    email,
    password,
    role,
    companyId: role === "customer" ? companyId : null,
    fullName,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/admin");
  redirect("/admin");
}

export async function updateUser(formData: FormData) {
  const { supabase } = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  const companyId = String(formData.get("companyId") ?? "").trim() || null;

  if (!userId || !isUserRole(role)) return;

  // Never trust the pair from the form: the database would reject a customer
  // with no company, but it should not be the thing that catches this.
  if (role === "customer" && !companyId) return;

  await supabase
    .from("profiles")
    .update({ role, company_id: role === "customer" ? companyId : null })
    .eq("id", userId);

  revalidatePath("/admin");
}

export async function setUserActive(formData: FormData) {
  const { supabase, userId: actorId } = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";

  if (!userId) return;

  // An admin locking themselves out is unrecoverable from inside the app.
  if (userId === actorId && !active) return;

  await supabase.from("profiles").update({ active }).eq("id", userId);

  revalidatePath("/admin");
}
