import type { Metadata } from "next";
import Link from "next/link";

import { CreateUserForm } from "@/components/admin/create-user-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/admin/require-admin";
import { listCompanies } from "@/lib/admin/users";

export const metadata: Metadata = {
  title: "New user",
};

export default async function NewUserPage() {
  const { supabase } = await requireAdmin();
  const companies = await listCompanies(supabase);

  return (
    <div>
      <PageHeader
        title="New user"
        description="Create a portal account and give it a role."
      />

      <Card className="mt-5 p-6">
        {companies.length === 0 ? (
          <p className="mb-4 rounded-field bg-warning-bg px-3 py-2 text-[12.5px] leading-relaxed text-warning-ink">
            There are no companies yet, so a customer cannot be created. Create
            a dispatcher, or add a company first.
          </p>
        ) : null}

        <CreateUserForm companies={companies} />
      </Card>

      <Link
        href="/admin"
        className="mt-5 inline-block text-[12.5px] font-medium text-accent transition-colors hover:text-accent-hover"
      >
        ← Back to users
      </Link>
    </div>
  );
}
