/**
 * What the customer's order page reads.
 *
 * Through the customer's own RLS session: `orders_customer` limits it to their
 * company, and the order's children inherit that. The original cart email is
 * not readable here — `inbound_emails` is dispatcher-only — so nothing on this
 * page may depend on it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { deliveryFields } from "@/lib/dispatch/draft-input";
import { isRetailerId, RETAILERS } from "@/lib/retailers";
import { orderStatusLabel, type OrderStatus } from "@/lib/tokens";

export type CustomerOrderItem = {
  id: string;
  description: string;
  storeSku: string | null;
  modelNumber: string | null;
  quantity: number;
  /** The retailer's link for the item. Kept since migration 0012. */
  productUrl: string | null;
};

export type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  retailerLabel: string;
  createdAt: string;
  /** When the customer approved it, or null if they have not. */
  customerConfirmedAt: string | null;
  store: { name: string; city: string | null; state: string | null } | null;
  siteLabel: string | null;
  delivery: ReturnType<typeof deliveryFields>;
  items: CustomerOrderItem[];
  price: {
    materialsCents: number;
    sizingCents: number;
    mileageCents: number;
    discountCents: number;
    taxCents: number;
    totalCents: number;
  };
};

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  retailer: string;
  retailer_store_id: string | null;
  site_id: string | null;
  delivery_address: unknown;
  delivery_instructions: string | null;
  materials_subtotal_cents: number;
  sizing_fee_cents: number;
  mileage_fee_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  created_at: string;
  customer_confirmed_at: string | null;
};

/**
 * The status as a customer should read it.
 *
 * The console's "Awaiting approval" is written from the dispatcher's side; the
 * customer is the one who approves, so it reads as their next step instead.
 */
export function portalStatusLabel(status: OrderStatus): string {
  return status === "awaiting_customer"
    ? "Ready to approve"
    : orderStatusLabel[status];
}

export async function loadCustomerOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<CustomerOrder | null> {
  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, retailer, retailer_store_id, site_id, delivery_address, delivery_instructions, materials_subtotal_cents, sizing_fee_cents, mileage_fee_cents, discount_cents, tax_cents, total_cents, created_at, customer_confirmed_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  const order = data as OrderRow | null;
  if (!order) return null;

  const [itemsResult, storeResult, siteResult] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, description, store_sku, model_number, quantity, product_url")
      .eq("order_id", order.id)
      .order("line_no", { ascending: true }),
    order.retailer_store_id
      ? supabase
          .from("retailer_stores")
          .select("name, city, state")
          .eq("id", order.retailer_store_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    order.site_id
      ? supabase
          .from("company_sites")
          .select("label")
          .eq("id", order.site_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const items = (
    (itemsResult.data ?? []) as {
      id: string;
      description: string;
      store_sku: string | null;
      model_number: string | null;
      quantity: number;
      product_url: string | null;
    }[]
  ).map((row) => ({
    id: row.id,
    description: row.description,
    storeSku: row.store_sku,
    modelNumber: row.model_number,
    quantity: row.quantity,
    productUrl: row.product_url,
  }));

  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    retailerLabel: isRetailerId(order.retailer)
      ? RETAILERS[order.retailer].label
      : order.retailer,
    createdAt: order.created_at,
    customerConfirmedAt: order.customer_confirmed_at,
    store: storeResult.data as CustomerOrder["store"],
    siteLabel:
      (siteResult.data as { label: string | null } | null)?.label ?? null,
    delivery: deliveryFields(
      order.delivery_address,
      order.delivery_instructions,
    ),
    items,
    price: {
      materialsCents: order.materials_subtotal_cents,
      sizingCents: order.sizing_fee_cents,
      mileageCents: order.mileage_fee_cents,
      discountCents: order.discount_cents,
      taxCents: order.tax_cents,
      totalCents: order.total_cents,
    },
  };
}
