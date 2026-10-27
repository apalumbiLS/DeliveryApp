import type { Metadata } from "next";
import Link from "next/link";

import { BrandLockup } from "@/components/ui/brand-lockup";
import { button } from "@/components/ui/button";
import { Chevron } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  description:
    "Build a cart at Home Depot or Lowe's. Share it with us. We buy it and deliver it to your site.",
};

const STEPS = [
  "Build a cart at Home Depot or Lowe's.",
  "Share it with us.",
  "We buy it and deliver it to your site.",
];

export default function LandingPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center bg-card-muted px-5 py-16">
      <div className="w-full max-w-sm">
        <BrandLockup className="justify-center" />

        <h1 className="mt-6 text-center text-[26px] leading-tight font-semibold tracking-tight text-ink">
          Get materials to your site.
        </h1>

        <ol className="mt-6 space-y-3">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-accent-ink">
                {i + 1}
              </span>
              <span className="pt-0.5 text-[14px] leading-snug text-ink">
                {step}
              </span>
            </li>
          ))}
        </ol>

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
          No account yet?{" "}
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
