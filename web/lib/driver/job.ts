/**
 * What the driver app reads.
 *
 * Before accepting, a driver sees the posting only, through `get_job_posting`:
 * the store, the delivery address, the items, the size and the payout — but
 * not the on-site contact or drop-off notes. After accepting, the
 * `orders_driver` policy lets them read the whole order. Both go through the
 * caller's RLS-scoped client, so the database decides which applies.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { isRetailerId, RETAILERS } from "@/lib/retailers";

import { isDriverStatus, type DriverStatus } from "./steps";

export type JobItem = {
  id: string;
  description: string;
  storeSku: string | null;
  modelNumber: string | null;
  quantity: number;
  productUrl: string | null;
};

export type JobPosting = {
  id: string;
  orderNumber: string;
  status: string;
  retailerLabel: string;
  store: {
    name: string | null;
    address: string | null;
    town: string | null;
  };
  delivery: {
    street: string | null;
    town: string | null;
  };
  deliverySize: string | null;
  items: JobItem[];
  payoutCents: number | null;
  postedAt: string;
  isMine: boolean;
};

export type DriverJob = {
  id: string;
  orderNumber: string;
  status: DriverStatus;
  retailerLabel: string;
  store: {
    name: string | null;
    address: string | null;
    town: string | null;
  };
  delivery: {
    street: string | null;
    town: string | null;
    contactName: string | null;
    contactPhone: string | null;
    instructions: string | null;
  };
  deliverySize: string | null;
  payoutCents: number | null;
  items: JobItem[];
  /** When the job reached each status it has passed through. */
  reachedAt: Partial<Record<DriverStatus, string>>;
};

export type JobSummary = {
  id: string;
  orderNumber: string;
  status: DriverStatus;
  storeName: string | null;
  deliveryTown: string | null;
  updatedAt: string;
};

function retailerLabel(retailer: string): string {
  return isRetailerId(retailer) ? RETAILERS[retailer].label : retailer;
}

function town(city: unknown, state: unknown): string | null {
  const parts = [city, state].filter(
    (part): part is string => typeof part === "string" && part.trim() !== "",
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** Street lines, then "City, ST 29601". */
function addressParts(address: Record<string, unknown>) {
  const street = [text(address.line1), text(address.line2)]
    .filter(Boolean)
    .join(", ");
  const place = [town(address.city, address.state), text(address.postalCode)]
    .filter(Boolean)
    .join(" ");
  return { street: street || null, town: place || null };
}

export async function loadJobPosting(
  supabase: SupabaseClient,
  orderId: string,
): Promise<JobPosting | null> {
  const { data, error } = await supabase.rpc("get_job_posting", {
    p_order_id: orderId,
  });
  if (error) throw new Error(`Could not load the job: ${error.message}`);

  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (!row) return null;

  return {
    id: row.order_id as string,
    orderNumber: row.order_number as string,
    status: row.status as string,
    retailerLabel: retailerLabel(row.retailer as string),
    store: {
      name: text(row.store_name),
      address: text(row.store_address),
      town: town(row.store_city, row.store_state),
    },
    delivery: addressParts({
      line1: row.delivery_line1,
      line2: row.delivery_line2,
      city: row.delivery_city,
      state: row.delivery_state,
      postalCode: row.delivery_postal_code,
    }),
    deliverySize: text(row.delivery_size),
    items: (row.items ?? []) as JobItem[],
    payoutCents: row.payout_cents as number | null,
    postedAt: row.posted_at as string,
    isMine: row.is_mine as boolean,
  };
}

export async function loadDriverJob(
  supabase: SupabaseClient,
  orderId: string,
): Promise<DriverJob | null> {
  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, retailer, retailer_store_id, delivery_address, delivery_instructions, delivery_size, driver_payout_cents",
    )
    .eq("id", orderId)
    .maybeSingle();

  const order = data as {
    id: string;
    order_number: string;
    status: string;
    retailer: string;
    retailer_store_id: string | null;
    delivery_address: Record<string, unknown> | null;
    delivery_instructions: string | null;
    delivery_size: string | null;
    driver_payout_cents: number | null;
  } | null;
  if (!order || !isDriverStatus(order.status)) return null;

  const [storeResult, itemsResult, eventsResult] = await Promise.all([
    order.retailer_store_id
      ? supabase
          .from("retailer_stores")
          .select("name, address_line1, city, state, postal_code")
          .eq("id", order.retailer_store_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("order_items")
      .select(
        "id, line_no, description, store_sku, model_number, quantity, product_url",
      )
      .eq("order_id", order.id)
      .order("line_no", { ascending: true }),
    supabase
      .from("order_status_events")
      .select("to_status, created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true }),
  ]);

  const store = storeResult.data as {
    name: string;
    address_line1: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
  } | null;

  const address = order.delivery_address ?? {};

  const reachedAt: DriverJob["reachedAt"] = {};
  for (const event of (eventsResult.data ?? []) as {
    to_status: string;
    created_at: string;
  }[]) {
    // The latest time wins: a job released back to drivers passes through
    // the same steps again.
    if (isDriverStatus(event.to_status)) {
      reachedAt[event.to_status] = event.created_at;
    }
  }

  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    retailerLabel: retailerLabel(order.retailer),
    store: {
      name: store?.name ?? null,
      address: text(store?.address_line1),
      town:
        [town(store?.city, store?.state), text(store?.postal_code)]
          .filter(Boolean)
          .join(" ") || null,
    },
    delivery: {
      ...addressParts(address),
      contactName: text(address.contactName),
      contactPhone: text(address.contactPhone),
      instructions: text(order.delivery_instructions),
    },
    deliverySize: order.delivery_size,
    payoutCents: order.driver_payout_cents,
    items: (
      (itemsResult.data ?? []) as {
        id: string;
        description: string;
        store_sku: string | null;
        model_number: string | null;
        quantity: number;
        product_url: string | null;
      }[]
    ).map((item) => ({
      id: item.id,
      description: item.description,
      storeSku: item.store_sku,
      modelNumber: item.model_number,
      quantity: item.quantity,
      productUrl: item.product_url,
    })),
    reachedAt,
  };
}

/** The caller's own jobs, most recently moved first. */
export async function listMyJobs(
  supabase: SupabaseClient,
  userId: string,
): Promise<JobSummary[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, retailer_store_id, delivery_address, updated_at",
    )
    .eq("assigned_driver_id", userId)
    .in("status", [
      "driver_assigned",
      "driver_at_store",
      "items_purchased",
      "en_route",
      "delivered",
    ])
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Could not load your jobs: ${error.message}`);

  const orders = (data ?? []) as {
    id: string;
    order_number: string;
    status: DriverStatus;
    retailer_store_id: string | null;
    delivery_address: Record<string, unknown> | null;
    updated_at: string;
  }[];

  const storeIds = [
    ...new Set(
      orders
        .map((order) => order.retailer_store_id)
        .filter((id): id is string => id !== null),
    ),
  ];
  const { data: stores } = storeIds.length
    ? await supabase
        .from("retailer_stores")
        .select("id, name")
        .in("id", storeIds)
    : { data: [] };
  const storeNames = new Map(
    ((stores ?? []) as { id: string; name: string }[]).map((row) => [
      row.id,
      row.name,
    ]),
  );

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    storeName: order.retailer_store_id
      ? (storeNames.get(order.retailer_store_id) ?? null)
      : null,
    deliveryTown: town(
      order.delivery_address?.city,
      order.delivery_address?.state,
    ),
    updatedAt: order.updated_at,
  }));
}

/**
 * Jobs posted to drivers that the caller has not declined, newest first.
 *
 * `get_open_jobs_for_driver` says which; each posting is then read through
 * `get_job_posting`, the same view the job link shows, so the list and the
 * job page cannot disagree. One call per posting is fine at pilot volume.
 */
export async function listOpenJobs(
  supabase: SupabaseClient,
): Promise<JobPosting[]> {
  const { data, error } = await supabase.rpc("get_open_jobs_for_driver");
  if (error) throw new Error(`Could not load open jobs: ${error.message}`);

  const ids = ((data ?? []) as { order_id: string }[]).map(
    (row) => row.order_id,
  );
  const postings = await Promise.all(
    ids.map((id) => loadJobPosting(supabase, id)),
  );

  return postings
    .filter(
      (posting): posting is JobPosting =>
        posting !== null && posting.status === "driver_requested",
    )
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}
