import type { Metadata } from "next";
import Link from "next/link";

import { BrandLockup } from "@/components/ui/brand-lockup";
import { button } from "@/components/ui/button";
import { Chevron } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  description:
    "Build a cart at Home Depot or Lowe's, share it with us, and we'll buy it and deliver it to your site.",
};

export default function LandingPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center bg-card-muted px-5 py-16">
      <div className="w-full max-w-sm">
        <BrandLockup className="justify-center" />

        <h1 className="mt-6 text-center text-[26px] leading-tight font-semibold tracking-tight text-ink">
          Materials, delivered.
        </h1>
        <p className="mt-3 text-center text-[13px] leading-relaxed text-ink-muted">
          Build a cart at Home Depot or Lowe&apos;s, share it with us, and
          we&apos;ll buy it and bring it to your site.
        </p>

        <Link
          href="/portal"
          className={cn(
            button({ intent: "primary", size: "md" }),
            "mt-7 w-full",
          )}
        >
          Open the portal
          <Chevron className="h-4 w-4" />
        </Link>

        <p className="mt-4 text-center text-[11.5px] leading-relaxed text-ink-faint">
          Accounts are set up by your dispatcher.{" "}
          <Link
            href="/request-access"
            className="font-medium text-accent transition-colors hover:text-accent-hover"
          >
            Request access
          </Link>
        </p>
      </div>
    </main>
  );
}
