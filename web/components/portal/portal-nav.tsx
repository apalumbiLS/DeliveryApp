"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/portal", label: "Home" },
  { href: "/portal/orders", label: "Orders" },
] as const;

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex w-full max-w-3xl gap-1 px-5 pb-2">
      {LINKS.map((link) => {
        // Starting an order is reached from Home, so it keeps Home lit rather
        // than leaving the nav with nothing selected.
        const active =
          link.href === "/portal"
            ? pathname === "/portal" || pathname === "/portal/start"
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-control px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
              active
                ? "bg-accent-soft text-accent-soft-ink"
                : "text-ink-muted hover:bg-sunken hover:text-ink",
            )}
          >
            {link.label}
            <PendingHint />
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * A bar under the clicked link while its page loads. Always rendered and only
 * faded in, so it never shifts the nav. Usually skipped: `app/portal/loading.tsx`
 * makes most navigations instant, and this covers the moment before that
 * fallback has been fetched.
 */
function PendingHint() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-accent opacity-0 transition-opacity duration-150 motion-reduce:transition-none",
        pending && "animate-pulse opacity-100 motion-reduce:animate-none",
      )}
    />
  );
}
