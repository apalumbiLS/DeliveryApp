import type { ReactNode } from "react";

import { ConsoleSidebar } from "./console-sidebar";

type ConsoleUser = { name: string; initials: string; role: string };

/**
 * The dispatcher console's chrome: a sidebar beside a column for the page.
 *
 * Distinct from `AppShell`, which is the narrow centred column the portal
 * uses. The review queue puts the retailer's email beside the lines the parser
 * read and a store's distance beside its alternatives — none of that fits in
 * 768px, and the mockups that this screen was designed against are 1120 wide.
 *
 * `app/(console)/layout.tsx` renders the frame once for every console section,
 * so the sidebar survives navigating between them; each section's layout adds
 * its own header and body. See docs/architecture/06-cart-parsing.md.
 */
export function ConsoleFrame({
  nav,
  user,
  collapsible,
  defaultCollapsed,
  canSignOut,
  children,
}: {
  /** Rendered in the sidebar. A `ConsoleNav` in the app; a static list in a mockup. */
  nav: ReactNode;
  user: ConsoleUser;
  /** Lets the sidebar collapse to icons. The nav's links must carry icons. */
  collapsible?: boolean;
  /** The remembered wide-screen preference, read from `CONSOLE_NAV_COOKIE`. */
  defaultCollapsed?: boolean;
  /** Offers sign-out in the sidebar. Off in mockups, where it would be real. */
  canSignOut?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 bg-surface font-sans text-ink">
      <ConsoleSidebar
        collapsible={collapsible}
        defaultCollapsed={defaultCollapsed}
        canSignOut={canSignOut}
        user={user}
      >
        {nav}
      </ConsoleSidebar>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

export function ConsoleHeader({
  title,
  note,
  actions,
}: {
  title: string;
  note?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-3.5">
      <div className="min-w-0">
        <h1 className="truncate text-[14px] font-semibold tracking-tight">
          {title}
        </h1>
        {note ? (
          <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">{note}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/** The frame, a header and a scrolling body in one — what the mockups use. */
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
  nav: ReactNode;
  user: ConsoleUser;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <ConsoleFrame nav={nav} user={user}>
      <ConsoleHeader title={title} note={note} actions={actions} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </ConsoleFrame>
  );
}
