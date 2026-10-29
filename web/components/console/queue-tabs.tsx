import Link from "next/link";

import type { QueueView } from "@/lib/dispatch/review-queue";
import { QUEUE_VIEWS } from "@/lib/dispatch/review-queue";
import { cn } from "@/lib/utils";

export const QUEUE_VIEW_LABELS: Record<QueueView, string> = {
  review: "To review",
  customer: "Awaiting approval",
  all: "All",
};

export const QUEUE_VIEW_EMPTY: Record<QueueView, string> = {
  review: "Nothing to review.",
  customer: "Nothing awaiting approval.",
  all: "No orders yet.",
};

/**
 * The tabs above the review page's order list.
 *
 * Grey rather than accent when active: the accent marks the open order in the
 * list below, and two blue highlights would make "which one is selected"
 * ambiguous again.
 */
export function QueueTabs({
  view,
  counts,
  hrefFor,
}: {
  view: QueueView;
  counts: Record<QueueView, number>;
  hrefFor: (view: QueueView) => string;
}) {
  return (
    <nav aria-label="Order lists" className="space-y-0.5 px-2 pt-2.5 pb-2">
      {QUEUE_VIEWS.map((option) => (
        <Link
          key={option}
          href={hrefFor(option)}
          aria-current={option === view ? "page" : undefined}
          className={cn(
            "flex items-center justify-between gap-2 rounded-control px-2.5 py-1.5 text-[12px] transition-colors",
            option === view
              ? "bg-sunken font-semibold text-ink"
              : "text-ink-muted hover:bg-card-muted hover:text-ink",
          )}
        >
          <span>{QUEUE_VIEW_LABELS[option]}</span>
          <span className="text-[11px] font-medium text-ink-faint tabular-nums">
            {counts[option]}
          </span>
        </Link>
      ))}
    </nav>
  );
}
