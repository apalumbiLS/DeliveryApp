import type { Metadata } from "next";
import Link from "next/link";

import { BrandLockup } from "@/components/ui/brand-lockup";
import { button } from "@/components/ui/button";
import { Chevron } from "@/components/ui/icons";
import { StepList } from "@/components/ui/step-list";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  description:
    "Build a cart at Home Depot or Lowe's. Send us the cart. We buy it and deliver it to your site.",
};

const STEPS = [
  "Build a cart at Home Depot or Lowe's",
  "Send us the cart",
  "We buy it and deliver it to your site",
];

export default function LandingPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center bg-card-muted px-5 py-16">
      <div className="w-full max-w-sm">
        <BrandLockup animated size="lg" className="justify-center" />

        <h1 className="mt-6 text-center text-[26px] leading-tight font-semibold tracking-tight text-ink">
          Get materials to your site.
        </h1>

        <StepList steps={STEPS} className="mt-6" />

        <Link
          href="/portal"
          className={cn(
            button({ intent: "primary", size: "lg" }),
            "mt-7 w-full",
          )}
        >
          Open the portal
          <Chevron className="h-4.5 w-4.5" />
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
