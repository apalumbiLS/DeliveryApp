import type { ReactNode } from "react";

import { AppShell } from "@/components/app/app-shell";
import { APP_NAME } from "@/lib/brand";
import { requireDriverApp } from "@/lib/driver/require-driver";

/**
 * The driver app guard. Like the portal's, a UX affordance: RLS and the job
 * functions are the boundary. A dispatcher may look in, to see a job as its
 * link shows it.
 */
export default async function DriverLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { role, fullName } = await requireDriverApp();

  return (
    <AppShell
      title={role === "driver" ? (fullName ?? "Driver") : "Driver app"}
      subtitle={role === "driver" ? APP_NAME : "Viewing as dispatcher"}
    >
      {children}
    </AppShell>
  );
}
