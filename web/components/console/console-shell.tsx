import type { ReactNode } from "react";

import { APP_MARK } from "@/lib/brand";

/**
 * The dispatcher console's chrome: a sidebar, a header, and a scrolling body.
 *
 * Distinct from `AppShell`, which is the narrow centred column the portal and
 * admin console share. The review queue puts the retailer's email beside the
 * lines the parser read and a store's distance beside its alternatives — none of
 * that fits in 768px, and the mockups that this screen was designed against are
 * 1120 wide.
 *
 * Lifted from `app/mockups/dispatch/parts.tsx` so the design artifact and the
 * real screen cannot drift apart. See docs/architecture/06-cart-parsing.md.
 */
export function ConsoleShell({
  title,
  note,
  nav,
  user,
  actions,
  children,
}: {
  title: string;
  note?: string;
  /** Rendered in the sidebar. A `ConsoleNav` in the app; a static list in a mockup. */
  nav: ReactNode;
  user: { name: string; initials: string; role: string };
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 bg-surface font-sans text-ink">
      <aside className="flex w-50 shrink-0 flex-col border-r border-hairline bg-card-muted px-3 py-4">
        <div className="flex items-center gap-2 px-2 pb-6">
          <div className="flex h-7 w-7 items-center justify-center rounded-control bg-accent text-[11px] font-semibold text-accent-ink">
            {APP_MARK}
          </div>
          <span className="text-[13px] font-semibold tracking-tight">
            Dispatch
          </span>
        </div>

        {nav}

        <div className="mt-auto flex items-center gap-2 border-t border-hairline-soft px-2 pt-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-[10.5px] font-semibold text-accent-soft-ink">
            {user.initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-medium">{user.name}</div>
            <div className="text-[11px] text-ink-faint">{user.role}</div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-3.5">
          <div className="min-w-0">
            <h1 className="truncate text-[14px] font-semibold tracking-tight">
              {title}
            </h1>
            {note ? (
              <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">
                {note}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
