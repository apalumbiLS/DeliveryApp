"use client";

import { Inbox, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use } from "react";

import { cn } from "@/lib/utils";

import { SIDEBAR_FADE } from "./sidebar";

/**
 * Icons by name: the dispatch layout is a server component, and a component
 * can't be passed from there to this one as a prop.
 */
const ICONS = {
  review: Inbox,
  users: Users,
} satisfies Record<string, LucideIcon>;

export type ConsoleNavLink = {
  href: string;
  label: string;
  /** Shown beside the label, and alone when the sidebar is collapsed. */
  icon: keyof typeof ICONS;
  /**
   * A count worth seeing without opening the page — the review queue's depth.
   * A promise streams in without holding up the page.
   */
  badge?: number | Promise<number>;
};

export function ConsoleNav({ links }: { links: ConsoleNavLink[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {links.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        const Icon = ICONS[link.icon];

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            title={link.label}
            className={cn(
              "flex items-center gap-2.5 rounded-control px-3 py-2 text-[12.5px] transition-colors",
              active
                ? "bg-card font-medium text-ink shadow-card"
                : "text-ink-muted hover:bg-sunken hover:text-ink",
            )}
          >
            <span className="relative shrink-0">
              <Icon aria-hidden className="size-4" />
              {link.badge !== undefined ? (
                <Suspense>
                  <BadgeDot badge={link.badge} />
                </Suspense>
              ) : null}
            </span>
            <span className={SIDEBAR_FADE}>{link.label}</span>
            {link.badge !== undefined ? (
              <Suspense>
                <BadgeCount badge={link.badge} />
              </Suspense>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function useBadge(badge: number | Promise<number>): number {
  // `use` suspends until a promise settles; a plain number passes through.
  return typeof badge === "number" ? badge : use(badge);
}

/** Marks the icon when the sidebar is collapsed and the count is hidden. */
function BadgeDot({ badge }: { badge: number | Promise<number> }) {
  if (!useBadge(badge)) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-accent opacity-0 transition-opacity duration-200 motion-reduce:transition-none nav-collapsed:opacity-100" />
  );
}

function BadgeCount({ badge }: { badge: number | Promise<number> }) {
  const count = useBadge(badge);
  if (!count) return null;
  return (
    <span
      className={cn(
        "ml-auto pl-2 text-[11px] text-ink-faint tabular-nums",
        SIDEBAR_FADE,
      )}
    >
      {count}
    </span>
  );
}
