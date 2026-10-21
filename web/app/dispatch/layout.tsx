import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { ConsoleNav } from "@/components/console/console-nav";
import { ConsoleShell } from "@/components/console/console-shell";
import { CONSOLE_NAV_COOKIE } from "@/components/console/sidebar";
import { requireDispatcher } from "@/lib/dispatch/require-dispatcher";

/**
 * The dispatcher console's guard and chrome.
 *
 * `requireDispatcher()` is a UX gate, not the security boundary — RLS decides
 * what a dispatcher may read, and every server action re-checks the caller
 * rather than trusting that this layout ran.
 *
 * See docs/architecture/10-auth-and-permissions.md.
 */

const QUEUE_STATUSES = ["received", "needs_review"];

function initialsOf(name: string | null): string {
  if (!name) return "D";
  const parts = name.trim().split(/\s+/);
  const initials = `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`;
  return initials.toUpperCase() || "D";
}

export default async function DispatchLayout(props: LayoutProps<"/dispatch">) {
  const { supabase, fullName } = await requireDispatcher();

  // A count, not the queue itself: the layout runs on every navigation, and the
  // page loads the rows it actually needs.
  const [ordersResult, inboundResult, cookieStore] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", QUEUE_STATUSES),
    supabase
      .from("inbound_emails")
      .select("id", { count: "exact", head: true })
      .eq("review_status", "pending")
      .is("order_id", null),
    cookies(),
  ]);

  const waiting = (ordersResult.count ?? 0) + (inboundResult.count ?? 0);

  return (
    <ConsoleShell
      title="Review queue"
      collapsible
      defaultCollapsed={
        cookieStore.get(CONSOLE_NAV_COOKIE)?.value === "collapsed"
      }
      note={
        waiting === 0
          ? "Nothing waiting."
          : `${waiting} waiting · every order is verified here before the invite goes out`
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
              badge: waiting,
            },
            { href: "/admin", label: "Admin users", icon: "users" },
          ]}
        />
      }
    >
      {props.children as ReactNode}
    </ConsoleShell>
  );
}
