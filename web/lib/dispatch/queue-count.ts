import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

const QUEUE_STATUSES = ["received", "needs_review"];

/**
 * How many orders and unmatched inbound emails are waiting for review.
 *
 * Both the console sidebar's badge and the review queue's header show it, from
 * different layouts; `cache` runs the query once per request for both. A count,
 * not the queue itself: the layouts run on every navigation, and the page loads
 * the rows it actually needs.
 */
export const getQueueCount = cache(async (): Promise<number> => {
  const supabase = await createClient();

  const [ordersResult, inboundResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", QUEUE_STATUSES),
    supabase
      .from("inbound_emails")
      .select("id", { count: "exact", head: true })
      .eq("review_status", "pending")
      .is("order_id", null),
  ]);

  return (ordersResult.count ?? 0) + (inboundResult.count ?? 0);
});
