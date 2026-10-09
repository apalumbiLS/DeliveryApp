"use server";

import { revalidatePath } from "next/cache";

import { DELIVERY_SIZES, type DeliverySize } from "@/components/console/size-picker";

import { requireDispatcher } from "./require-dispatcher";

/**
 * The two things a dispatcher does to an order before it can be invited:
 * confirm the store, and price it.
 *
 * Both re-read what the form claims rather than trusting it — the store must
 * belong to the order's retailer, and the money must parse. A server action can
 * be invoked directly, so a form field is not evidence of anything.
 */

const MAX_FEE_CENTS = 100_000_00;

function parseSize(value: FormDataEntryValue | null): DeliverySize | null {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (DELIVERY_SIZES as readonly string[]).includes(raw)
    ? (raw as DeliverySize)
    : null;
}

/** Dollars from the form to integer cents, which is how every money column is stored. */
function parseCents(value: FormDataEntryValue | null): number | null {
  const raw = typeof value === "string" ? value.trim().replace(/[$,]/g, "") : "";
  if (raw === "") return 0;

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) return null;

  const cents = Math.round(amount * 100);
  return cents > MAX_FEE_CENTS ? null : cents;
}

export async function updateOrderStore(formData: FormData): Promise<void> {
  const { supabase } = await requireDispatcher();

  const orderId = String(formData.get("orderId") ?? "");
  const storeId = String(formData.get("storeId") ?? "");
  if (!orderId || !storeId) return;

  const { data: orderData } = await supabase
    .from("orders")
    .select("retailer")
    .eq("id", orderId)
    .maybeSingle();

  const order = orderData as { retailer: string } | null;
  if (!order) return;

  const { data: storeData } = await supabase
    .from("retailer_stores")
    .select("id, retailer, active")
    .eq("id", storeId)
    .maybeSingle();

  const store = storeData as { id: string; retailer: string; active: boolean } | null;

  // The store has to belong to the same retailer as the cart. Switching a
  // Home Depot cart to a Lowe's store would send a driver somewhere the cart
  // cannot be bought.
  if (!store || !store.active || store.retailer !== order.retailer) return;

  await supabase
    .from("orders")
    .update({ retailer_store_id: storeId })
    .eq("id", orderId);

  revalidatePath(`/dispatch/review/${orderId}`);
  revalidatePath("/dispatch/review");
}

export async function updateOrderQuote(formData: FormData): Promise<void> {
  const { supabase } = await requireDispatcher();

  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return;

  const deliverySize = parseSize(formData.get("deliverySize"));
  const materialsCents = parseCents(formData.get("materials"));
  const sizingCents = parseCents(formData.get("sizing"));
  const mileageCents = parseCents(formData.get("mileage"));

  if (
    materialsCents === null ||
    sizingCents === null ||
    mileageCents === null
  ) {
    // An unparseable amount is a bug or an attack, not a dispatcher mistake.
    // Leave the order untouched rather than writing a garbage total.
    return;
  }

  const { data: orderData } = await supabase
    .from("orders")
    .select("tax_cents, discount_cents")
    .eq("id", orderId)
    .maybeSingle();

  const order = orderData as { tax_cents: number; discount_cents: number } | null;
  if (!order) return;

  const totalCents =
    materialsCents +
    sizingCents +
    mileageCents +
    order.tax_cents -
    order.discount_cents;

  await supabase
    .from("orders")
    .update({
      delivery_size: deliverySize,
      materials_subtotal_cents: materialsCents,
      sizing_fee_cents: sizingCents,
      mileage_fee_cents: mileageCents,
      total_cents: Math.max(0, totalCents),
    })
    .eq("id", orderId);

  revalidatePath(`/dispatch/review/${orderId}`);
  revalidatePath("/dispatch/review");
}
