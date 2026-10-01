import type { ReactNode } from "react";

import { SignOutButton } from "@/components/app/sign-out-button";
import { APP_MARK } from "@/lib/brand";

/**
 * The signed-in chrome shared by the customer portal and the admin console:
 * brand, a title block, a nav slot, and sign out.
 */
export function AppShell({
  title,
  subtitle,
  nav,
  children,
}: {
  title: string;
  subtitle: string;
  nav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-card-muted">
      <header className="border-b border-hairline bg-card">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-accent text-[12px] font-semibold text-accent-ink">
              {APP_MARK}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-ink">
                {title}
              </div>
              <div className="truncate text-[11px] text-ink-faint">
                {subtitle}
              </div>
            </div>
          </div>

          <SignOutButton />
        </div>

        {nav}
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6">
        {children}
      </main>
    </div>
  );
}
