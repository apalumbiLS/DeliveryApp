"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type ConsoleNavLink = {
  href: string;
  label: string;
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

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center justify-between rounded-control px-2.5 py-2 text-[12.5px] transition-colors",
              active
                ? "bg-card font-medium text-ink shadow-card"
                : "text-ink-muted hover:bg-sunken hover:text-ink",
            )}
          >
            <span>{link.label}</span>
            {link.badge ? (
              <span className="text-[11px] text-ink-faint tabular-nums">
                {link.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
