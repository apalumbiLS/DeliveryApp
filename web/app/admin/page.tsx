import type { Metadata } from "next";
import Link from "next/link";

import { UserRowActions } from "@/components/admin/user-row-actions";
import { Badge } from "@/components/ui/badge";
import { button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusDot } from "@/components/ui/status-dot";
import { requireAdmin } from "@/lib/admin/require-admin";
import { listCompanies, listDirectory } from "@/lib/admin/users";
import { userRoleLabel, userRoleTone } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Users",
};

export default async function AdminUsersPage() {
  const { supabase } = await requireAdmin();

  const [users, companies] = await Promise.all([
    listDirectory(supabase),
    listCompanies(supabase),
  ]);

  return (
    <div>
      <PageHeader
        title="Users"
        description="Portal accounts. One login per company for now — the schema already allows more."
        actions={
          <Link
            href="/admin/users/new"
            className={cn(button({ intent: "primary", size: "md" }))}
          >
            New user
          </Link>
        }
      />

      {users.length === 0 ? (
        <Card className="mt-5 p-6">
          <h2 className="text-[13px] font-medium text-ink">No accounts yet</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
            Create the first one with “New user”.
          </p>
        </Card>
      ) : (
        <div className="mt-5 space-y-3">
          {users.map((user) => (
            <Card key={user.id} className="p-4">
              <div className="flex items-start gap-3">
                <StatusDot
                  tone={user.active === false ? "neutral" : "success"}
                  className="mt-1.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium text-ink">
                      {user.email ?? "No email"}
                    </span>
                    {user.role ? (
                      <Badge tone={userRoleTone[user.role]} bordered>
                        {userRoleLabel[user.role]}
                      </Badge>
                    ) : (
                      <Badge tone="warning" bordered>
                        No profile
                      </Badge>
                    )}
                    {user.active === false ? (
                      <Badge tone="neutral" bordered>
                        Inactive
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink-faint">
                    {user.fullName ?? "No name"} ·{" "}
                    {user.companyName ?? "No company"}
                  </div>
                </div>
              </div>

              <UserRowActions
                userId={user.id}
                role={user.role}
                companyId={user.companyId}
                active={user.active !== false}
                companies={companies}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
