import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { isAdminConfigured } from "@/lib/admin/config";

/**
 * The admin console's body. The guard and sidebar are in
 * `app/(console)/layout.tsx`.
 *
 * "Admin" is not a role — dispatchers hold administrative permissions, so the
 * console's dispatcher guard covers it. As with the portal, that is a UX
 * affordance: RLS is the boundary, and every privileged action re-checks the
 * caller with `requireAdmin()` rather than trusting that a layout ran.
 *
 * The forms were laid out for a narrow column, so the body keeps that width
 * inside the wider console. Each page brings its own `PageHeader`.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <main className="mx-auto w-full max-w-3xl px-5 py-6">
        {isAdminConfigured() ? (
          children
        ) : (
          <Card className="p-6">
            <h2 className="text-[13px] font-medium text-ink">
              The secret key is not set
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
              Creating and listing accounts needs{" "}
              <code>SUPABASE_SECRET_KEY</code> in <code>web/.env.local</code>.
              It is server-only — never prefix it with <code>NEXT_PUBLIC_</code>
              .
            </p>
          </Card>
        )}
      </main>
    </div>
  );
}
