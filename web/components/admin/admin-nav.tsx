"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dispatch/review", label: "Review queue" },
  { href: "/admin", label: "Users" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex w-full max-w-3xl gap-1 px-5 pb-2">
      {LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-control px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
              active
                ? "bg-accent-soft text-accent-soft-ink"
                : "text-ink-muted hover:bg-sunken hover:text-ink",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
