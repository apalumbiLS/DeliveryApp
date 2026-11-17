/**
 * What the driver recorded on a job: when each step happened, and the receipt
 * and delivery photos — or why one was skipped.
 *
 * Photos live in the private `evidence` bucket. The page links to
 * `/dispatch/photo/<id>`, which signs a fresh URL on every request, so a link
 * never goes stale while the page is open.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { isDriverStatus, type DriverStatus } from "@/lib/driver/steps";

export type EvidenceItem = {
  id: string;
  kind: "receipt" | "delivery";
  /** Null when the photo was skipped. */
  url: string | null;
  skipReason: string | null;
  at: string;
};

export type DriverEvidence = {
  /** When the job reached each driver status since it was last posted. */
  reachedAt: Partial<Record<DriverStatus, string>>;
  /** Oldest first. A released job can hold more than one of each kind. */
  items: EvidenceItem[];
  /** Set when the job was taken back from a driver at some point. */
  releasedAt: string | null;
};

export async function loadDriverEvidence(
  supabase: SupabaseClient,
  orderId: string,
): Promise<DriverEvidence> {
  const [eventsResult, attachmentsResult] = await Promise.all([
    supabase
      .from("order_status_events")
      .select("from_status, to_status, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    supabase
      .from("attachments")
      .select("id, kind, storage_path, skip_reason, created_at")
      .eq("order_id", orderId)
      .in("kind", ["receipt", "delivery"])
      .order("created_at", { ascending: true }),
  ]);
  if (attachmentsResult.error) {
    throw new Error(
      `Could not load the driver's photos: ${attachmentsResult.error.message}`,
    );
  }

  const reachedAt: DriverEvidence["reachedAt"] = {};
  let releasedAt: string | null = null;
  for (const event of (eventsResult.data ?? []) as {
    from_status: string | null;
    to_status: string;
    created_at: string;
  }[]) {
    if (isDriverStatus(event.to_status)) {
      reachedAt[event.to_status] = event.created_at;
    }
    // A release starts the steps over for the next driver.
    if (
      event.to_status === "driver_requested" &&
      event.from_status !== null &&
      isDriverStatus(event.from_status)
    ) {
      releasedAt = event.created_at;
      for (const status of Object.keys(reachedAt) as DriverStatus[]) {
        delete reachedAt[status];
      }
    }
  }

  const rows = (attachmentsResult.data ?? []) as {
    id: string;
    kind: "receipt" | "delivery";
    storage_path: string | null;
    skip_reason: string | null;
    created_at: string;
  }[];

  return {
    reachedAt,
    releasedAt,
    items: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      url: row.storage_path ? `/dispatch/photo/${row.id}` : null,
      skipReason: row.skip_reason,
      at: row.created_at,
    })),
  };
}
