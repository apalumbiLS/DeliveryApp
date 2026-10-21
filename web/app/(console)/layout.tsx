import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { ConsoleNav } from "@/components/console/console-nav";
import { ConsoleFrame } from "@/components/console/console-shell";
import { CONSOLE_NAV_COOKIE } from "@/components/console/sidebar";
import { getQueueCount } from "@/lib/dispatch/queue-count";
import { requireDispatcher } from "@/lib/dispatch/require-dispatcher";

/**
 * The dispatcher console's guard and chrome, shared by `/dispatch` and
 * `/admin` so the sidebar stays put when moving between them.
 *
 * `requireDispatcher()` is a UX gate, not the security boundary — RLS decides
 * what a dispatcher may read, and every server action re-checks the caller
 * rather than trusting that this layout ran.
 *
 * See docs/architecture/10-auth-and-permissions.md.
 */

function initialsOf(name: string | null): string {
  if (!name) return "D";
  const parts = name.trim().split(/\s+/);
  const initials = `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`;
  return initials.toUpperCase() || "D";
}

export default async function ConsoleLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [{ fullName }, cookieStore] = await Promise.all([
    requireDispatcher(),
    cookies(),
  ]);

  return (
    <ConsoleFrame
      collapsible
      canSignOut
      defaultCollapsed={
        cookieStore.get(CONSOLE_NAV_COOKIE)?.value === "collapsed"
      }
      user={{
        name: fullName ?? "Dispatcher",
        initials: initialsOf(fullName),
        role: "Dispatcher",
      }}
      nav={
        <ConsoleNav
          links={[
            {
              href: "/dispatch/review",
              label: "Review queue",
              icon: "review",
              // Not awaited: the badge streams in, so pages that don't show
              // the count (admin) don't wait for it.
              badge: getQueueCount(),
            },
            { href: "/admin", label: "Users", icon: "users" },
          ]}
        />
      }
    >
      {children}
    </ConsoleFrame>
  );
}
