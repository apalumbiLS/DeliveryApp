/**
 * How far the driver has got, as the customer sees it: when the job was posted
 * and reached each step, and the delivery photo.
 *
 * Through the customer's own RLS session. `attachments_read` shows customers
 * delivery photos only, never the receipt. A skipped photo's reason is the
 * dispatcher's, so it is not shown here.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  stepTimes,
  type DriverStatus,
  type StepEvent,
} from "@/lib/driver/steps";

export type DeliveryProgress = {
  postedAt: string | null;
  reachedAt: Partial<Record<DriverStatus, string>>;
  /** Links to `/portal/photo/<id>`, newest first. */
  photos: { id: string; url: string; at: string }[];
};

export async function loadDeliveryProgress(
  supabase: SupabaseClient,
  orderId: string,
): Promise<DeliveryProgress> {
  const [eventsResult, photosResult] = await Promise.all([
    supabase
      .from("order_status_events")
      .select("from_status, to_status, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    supabase
      .from("attachments")
      .select("id, created_at")
      .eq("order_id", orderId)
      .eq("kind", "delivery")
      .not("storage_path", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  const { postedAt, reachedAt } = stepTimes(
    (eventsResult.data ?? []) as StepEvent[],
  );

  return {
    postedAt,
    reachedAt,
    photos: (
      (photosResult.data ?? []) as { id: string; created_at: string }[]
    ).map((row) => ({
      id: row.id,
      url: `/portal/photo/${row.id}`,
      at: row.created_at,
    })),
  };
}
