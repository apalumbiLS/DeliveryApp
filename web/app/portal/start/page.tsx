import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Start an order",
};

const STEPS = [
  {
    title: "Where it's going",
    body: "Pick the job site — that's where we deliver.",
  },
  {
    title: "Where you'll shop",
    body: "Home Depot or Lowe's. You build the cart on their site.",
  },
  {
    title: "The store",
    body: "We suggest the nearest one and you can change it.",
  },
  {
    title: "Check your store",
    body: "We show you how to confirm it before you build the cart.",
  },
  {
    title: "Build & share",
    body: "Add your items, then share the cart to your company's address.",
  },
];

/**
 * Scaffold for the real start-an-order flow. The steps mirror the approved
 * mockup at /mockups/start; this page is the placeholder the home card points
 * at until that flow is built.
 */
export default function PortalStartPage() {
  return (
    <div>
      <PageHeader
        title="Start an order"
        description="Build a cart at Home Depot or Lowe's, then share it with us."
      />

      <Card className="mt-5 p-6">
        <Badge tone="warning" bordered>
          Coming next
        </Badge>

        <h2 className="mt-3 text-[15px] font-semibold tracking-tight text-ink">
          This flow is the next thing we build
        </h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
          The design is settled. These are the five steps that will live here.
        </p>

        <ol className="mt-5 space-y-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sunken text-[11.5px] font-semibold text-ink-muted tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-ink">
                  {step.title}
                </span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-muted">
                  {step.body}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <Link
          href="/portal"
          className="mt-6 inline-block text-[12.5px] font-medium text-accent transition-colors hover:text-accent-hover"
        >
          ← Back to home
        </Link>
      </Card>
    </div>
  );
}
