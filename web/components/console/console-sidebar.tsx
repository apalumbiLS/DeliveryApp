"use client";

import { ChevronsLeft, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { signOut } from "@/app/actions/auth";

import { TruckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

import { CONSOLE_NAV_COOKIE, SIDEBAR_FADE } from "./sidebar";

const WIDE = "(min-width: 48rem)";

/**
 * The console sidebar, optionally collapsible to icons.
 *
 * Wide screens follow a preference kept in a cookie, so the server renders the
 * right width and the page doesn't jump on load. Narrow screens always start
 * collapsed; there the panel sits over a fixed-width placeholder, so opening it
 * covers the page rather than squeezing it, and navigating closes it.
 *
 * Children style themselves with the `nav-collapsed:` and `nav-expanded:`
 * variants (app/globals.css) and `SIDEBAR_FADE` instead of reading state, so
 * they can stay server components and the right layout shows before hydration.
 * Icons sit at a fixed inset and only the width animates, so nothing moves
 * sideways as it collapses.
 */
export function ConsoleSidebar({
  collapsible = false,
  defaultCollapsed = false,
  canSignOut = false,
  user,
  children,
}: {
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  canSignOut?: boolean;
  user: { name: string; initials: string; role: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);
  // The path it was opened on, so navigating closes it without an effect.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = !collapsible || openedOn === pathname;

  useEffect(() => {
    if (!collapsible || !open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenedOn(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collapsible, open]);

  function toggle() {
    if (window.matchMedia(WIDE).matches) {
      const next = !collapsed;
      setCollapsed(next);
      document.cookie = `${CONSOLE_NAV_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
    } else {
      setOpenedOn(open ? null : pathname);
    }
  }

  // Width waits for the labels to fade out when collapsing; the labels wait for
  // the width when expanding (SIDEBAR_FADE).
  const widthMotion =
    "transition-[width,box-shadow] duration-200 ease-out nav-collapsed:delay-100 motion-reduce:transition-none";

  return (
    <aside
      data-nav-collapsed={collapsed}
      data-nav-open={open}
      className={cn(
        "shrink-0",
        collapsible
          ? cn(
              // Pinned to the viewport on wide screens, so the footer controls
              // stay in view however long the page is.
              "w-14 md:sticky md:top-0 md:h-dvh md:w-50 md:self-start md:overflow-hidden nav-collapsed:w-14",
              widthMotion,
            )
          : "w-50",
      )}
    >
      <div
        id="console-sidebar"
        className={cn(
          "flex h-full w-full flex-col overflow-x-hidden overflow-y-auto border-r border-hairline bg-card-muted px-2 py-4",
          collapsible &&
            cn(
              "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:w-14 max-md:nav-expanded:w-50 max-md:nav-expanded:shadow-card",
              widthMotion,
            ),
        )}
      >
        <div className="flex items-center gap-2 px-1.5 pb-6">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-accent text-[11px] font-semibold text-accent-ink">
            <TruckIcon className="h-4 w-4" />
          </div>
          <span
            className={cn(
              "text-[13px] font-semibold tracking-tight",
              SIDEBAR_FADE,
            )}
          >
            Dispatch
          </span>
        </div>

        {children}

        <div className="mt-auto space-y-2">
          {collapsible ? (
            <button
              type="button"
              onClick={toggle}
              aria-controls="console-sidebar"
              aria-label="Toggle navigation"
              title="Toggle navigation"
              className="flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-[12.5px] text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <ChevronsLeft
                aria-hidden
                className="size-4 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none nav-collapsed:rotate-180"
              />
              <span aria-hidden className={SIDEBAR_FADE}>
                Collapse
              </span>
            </button>
          ) : null}

          {canSignOut ? (
            // Sign-out is a mutation, so it is a form posting to a server action.
            <form action={signOut}>
              <SignOutRow />
            </form>
          ) : null}

          <div className="flex items-center gap-2 border-t border-hairline-soft px-1.5 pt-3">
            <div
              title={`${user.name} · ${user.role}`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10.5px] font-semibold text-accent-soft-ink"
            >
              {user.initials}
            </div>
            {/* Shrinks so a long name ends in an ellipsis, not at the edge. */}
            <div className={cn(SIDEBAR_FADE, "min-w-0 flex-1 shrink")}>
              <div className="truncate text-[12px] font-medium">
                {user.name}
              </div>
              <div className="text-[11px] text-ink-faint">{user.role}</div>
            </div>
          </div>
        </div>
      </div>

      {collapsible ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close navigation"
          onClick={() => setOpenedOn(null)}
          className="pointer-events-none fixed inset-0 z-30 bg-ink/20 opacity-0 transition-opacity duration-200 ease-out motion-reduce:transition-none md:hidden nav-expanded:pointer-events-auto nav-expanded:opacity-100"
        />
      ) : null}
    </aside>
  );
}

function SignOutRow() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Sign out"
      title="Sign out"
      className="flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-[12.5px] text-ink-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-60"
    >
      <LogOut aria-hidden className="size-4 shrink-0" />
      <span aria-hidden className={SIDEBAR_FADE}>
        {pending ? "Signing out…" : "Sign out"}
      </span>
    </button>
  );
}
