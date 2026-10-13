import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DELIVERY_SIZES,
  type DeliverySize,
} from "@/components/console/size-picker";

const MAX_CENTS = 10_000_000;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type DeliveryDraft = {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  contactName: string;
  contactPhone: string;
  instructions: string | null;
};

export type QuoteDraft = {
  deliverySize: DeliverySize;
  materialsCents: number;
  sizingCents: number;
  mileageCents: number;
};

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function cents(raw: string): number | null {
  const value = raw.replace(/[$,]/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount <= MAX_CENTS ? amount : null;
}

export function parseQuoteDraft(form: FormData): Result<QuoteDraft> {
  const size = text(form, "deliverySize");
  const materials = cents(text(form, "materials") || "0");
  const sizing = cents(text(form, "sizing") || "0");
  const mileage = cents(text(form, "mileage") || "0");
  if (
    !(DELIVERY_SIZES as readonly string[]).includes(size) ||
    materials === null ||
    sizing === null ||
    mileage === null
  ) {
    return {
      ok: false,
      error: "Pick a size and enter valid amounts in dollars.",
    };
  }
  return {
    ok: true,
    value: {
      deliverySize: size as DeliverySize,
      materialsCents: materials,
      sizingCents: sizing,
      mileageCents: mileage,
    },
  };
}

export function parseDeliveryDraft(form: FormData): Result<DeliveryDraft> {
  const line1 = text(form, "line1");
  const line2 = text(form, "line2");
  const city = text(form, "city");
  const state = text(form, "state");
  const postalCode = text(form, "postalCode");
  const contactName = text(form, "contactName");
  const contactPhone = text(form, "contactPhone");
  const instructions = text(form, "instructions");
  const digits = contactPhone.replace(/\D/g, "");
  if (
    !line1 ||
    line1.length > 200 ||
    line2.length > 200 ||
    !city ||
    city.length > 100 ||
    !state ||
    state.length > 40 ||
    !postalCode ||
    postalCode.length > 16 ||
    !contactName ||
    contactName.length > 120 ||
    contactPhone.length < 7 ||
    contactPhone.length > 40 ||
    digits.length < 7 ||
    digits.length > 15 ||
    instructions.length > 1000
  ) {
    return {
      ok: false,
      error: "Enter a complete address and on-site contact.",
    };
  }
  return {
    ok: true,
    value: {
      line1,
      line2: line2 || null,
      city,
      state,
      postalCode,
      contactName,
      contactPhone,
      instructions: instructions || null,
    },
  };
}

export async function saveDispatcherDraft(
  supabase: SupabaseClient,
  orderId: string,
  kind: "store" | "delivery" | "quote",
  values: Record<string, unknown>,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("update_dispatcher_draft", {
      p_order_id: orderId,
      p_kind: kind,
      p_values: values,
    });
    return !error && data === orderId;
  } catch {
    return false;
  }
}

export function deliveryFields(address: unknown, instructions: string | null) {
  const value =
    address && typeof address === "object"
      ? (address as Record<string, unknown>)
      : {};
  const part = (key: string) =>
    typeof value[key] === "string" ? (value[key] as string).trim() : "";
  return {
    line1: part("line1"),
    line2: part("line2"),
    city: part("city"),
    state: part("state"),
    postalCode: part("postalCode"),
    contactName: part("contactName"),
    contactPhone: part("contactPhone"),
    instructions: instructions ?? "",
  };
}
