import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { listQueue } from "@/lib/dispatch/review-queue";
import { requireDispatcher } from "@/lib/dispatch/require-dispatcher";

export const metadata: Metadata = {
  title: "Review queue",
};

export default async function ReviewQueuePage() {
  const { supabase } = await requireDispatcher();
  const queue = await listQueue(supabase);

  if (queue.length === 0) {
    return (
      <div className="px-5 py-6">
        <Card className="p-6">
          <h2 className="text-[13px] font-medium text-ink">Nothing waiting</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
            A cart lands here as soon as a customer shares one. An empty queue
            means every order has been verified and sent on.
          </p>
        </Card>
      </div>
    );
  }

  // Oldest first, so the URL a dispatcher bookmarks is the one that has waited
  // longest.
  redirect(`/dispatch/review/${queue[0].id}`);
}
