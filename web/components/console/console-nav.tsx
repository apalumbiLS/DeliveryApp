"use client";

import { Inbox, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
  /** A count worth seeing without opening the page — the review queue's depth. */
  badge?: number;
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
            title={link.badge ? `${link.label} (${link.badge})` : link.label}
            className={cn(
              "flex items-center gap-2.5 rounded-control px-3 py-2 text-[12.5px] transition-colors",
              active
                ? "bg-card font-medium text-ink shadow-card"
                : "text-ink-muted hover:bg-sunken hover:text-ink",
            )}
          >
            <span className="relative shrink-0">
              <Icon aria-hidden className="size-4" />
              {link.badge ? (
                <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-accent opacity-0 transition-opacity duration-200 motion-reduce:transition-none nav-collapsed:opacity-100" />
              ) : null}
            </span>
            <span className={SIDEBAR_FADE}>{link.label}</span>
            {link.badge ? (
              <span
                className={cn(
                  "ml-auto pl-2 text-[11px] text-ink-faint tabular-nums",
                  SIDEBAR_FADE,
                )}
              >
                {link.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
