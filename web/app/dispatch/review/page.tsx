import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { listInboundExceptions, listQueue } from "@/lib/dispatch/review-queue";
import { requireDispatcher } from "@/lib/dispatch/require-dispatcher";

export const metadata: Metadata = {
  title: "Review queue",
};

export default async function ReviewQueuePage() {
  const { supabase } = await requireDispatcher();
  const [queue, exceptions] = await Promise.all([
    listQueue(supabase),
    listInboundExceptions(supabase),
  ]);

  if (queue.length === 0 && exceptions.length > 0) {
    redirect(`/dispatch/review/inbound/${exceptions[0].id}`);
  }

  if (queue.length === 0) {
    return (
      <div className="px-5 py-6">
        <Card className="p-6">
          <h2 className="text-[13px] font-medium text-ink">Nothing waiting</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
            New carts and exceptions appear here. No email is waiting for
            dispatcher review.
          </p>
        </Card>
      </div>
    );
  }

  // Oldest first, so the URL a dispatcher bookmarks is the one that has waited
  // longest.
  redirect(`/dispatch/review/${queue[0].id}`);
}
