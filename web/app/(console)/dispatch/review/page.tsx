import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  QUEUE_VIEW_EMPTY,
  QUEUE_VIEW_LABELS,
} from "@/components/console/queue-tabs";
import { button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  countQueueViews,
  isQueueView,
  listInboundExceptions,
  listQueue,
  QUEUE_VIEWS,
} from "@/lib/dispatch/review-queue";
import { requireDispatcher } from "@/lib/dispatch/require-dispatcher";

export const metadata: Metadata = {
  title: "Review queue",
};

export default async function ReviewQueuePage(
  props: PageProps<"/dispatch/review">,
) {
  const { view: requested } = await props.searchParams;
  const view = isQueueView(requested) ? requested : "review";
  const { supabase } = await requireDispatcher();

  const [queue, exceptions, counts] = await Promise.all([
    listQueue(supabase, view),
    view === "review" ? listInboundExceptions(supabase) : Promise.resolve([]),
    countQueueViews(supabase),
  ]);

  // Oldest first in the worklists, so the URL a dispatcher bookmarks is the one
  // that has waited longest. Only "All" has to be named on the order's URL; the
  // other two follow the order's status.
  if (queue.length > 0) {
    redirect(
      `/dispatch/review/${queue[0].id}${view === "all" ? "?view=all" : ""}`,
    );
  }

  if (exceptions.length > 0) {
    redirect(`/dispatch/review/inbound/${exceptions[0].id}`);
  }

  // Nothing in this list, so there is no order to open — offer the others,
  // which would otherwise be unreachable from an empty queue.
  const others = QUEUE_VIEWS.filter(
    (option) => option !== view && counts[option] > 0,
  );

  return (
    <div className="px-5 py-6">
      <Card className="p-6">
        <h2 className="text-[13px] font-medium text-ink">
          {view === "review" ? "Nothing waiting" : QUEUE_VIEW_EMPTY[view]}
        </h2>
        {view === "review" ? (
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
            New carts and exceptions appear here. No email is waiting for
            dispatcher review.
          </p>
        ) : null}
        {others.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {others.map((option) => (
              <Link
                key={option}
                href={`/dispatch/review?view=${option}`}
                className={button({ intent: "secondary", size: "sm" })}
              >
                {QUEUE_VIEW_LABELS[option]} · {counts[option]}
              </Link>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
