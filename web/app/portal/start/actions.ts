"use server";

import { normalizeZip } from "@/lib/geo";
import { requireCustomer } from "@/lib/portal/require-customer";
import { isRetailerId } from "@/lib/retailers";

export type DeliveryAddress = {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
};

export type IntentInput = {
  retailer: string;
  storeId: string;
  site:
    | { kind: "saved"; siteId: string }
    | ({ kind: "new"; label: string | null } & DeliveryAddress);
};

export type SaveIntentResult =
  { ok: true; intentId: string } | { ok: false; error: string };

type StoreRow = { id: string; retailer: string; active: boolean };

type SiteRow = {
  id: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
};

/**
 * Record the customer's choices as an order intent.
 *
 * An intent is a draft, not an order — the order still originates only from a
 * cart email (ADR-0010). This is called once, on the way into the final step,
 * which is the last moment before the customer leaves for the retailer's site.
 *
 * Nothing from the client is trusted: the store is re-read and checked against
 * the retailer, and a saved site is re-read through RLS, which scopes the query
 * to the caller's own company.
 */
export async function saveOrderIntent(
  input: IntentInput,
): Promise<SaveIntentResult> {
  const { supabase, userId, companyId } = await requireCustomer();

  if (!isRetailerId(input.retailer)) {
    return { ok: false, error: "Pick a retailer." };
  }

  const storeId = String(input.storeId ?? "");
  if (!storeId) return { ok: false, error: "Pick a store." };

  const { data: storeData } = await supabase
    .from("retailer_stores")
    .select("id, retailer, active")
    .eq("id", storeId)
    .single();

  const store = storeData as unknown as StoreRow | null;

  if (!store || !store.active || store.retailer !== input.retailer) {
    return {
      ok: false,
      error: "That store isn't available for this retailer.",
    };
  }

  let siteId: string;
  let address: DeliveryAddress;
  // Only the "new address" branch can set this — a saved site already has, or
  // has not, coordinates of its own.
  let centroid: { lat: number; lng: number } | null = null;

  if (input.site.kind === "saved") {
    const { data: siteData } = await supabase
      .from("company_sites")
      .select("id, address_line1, address_line2, city, state, postal_code")
      .eq("id", input.site.siteId)
      .single();

    const site = siteData as unknown as SiteRow | null;

    // RLS scopes this to the caller's company, so a miss means the site is not
    // theirs — or does not exist.
    if (!site) return { ok: false, error: "That site isn't available." };

    siteId = site.id;
    address = {
      line1: site.address_line1 ?? "",
      line2: site.address_line2,
      city: site.city ?? "",
      state: site.state ?? "",
      postalCode: site.postal_code ?? "",
    };
  } else {
    address = {
      line1: input.site.line1.trim(),
      line2: input.site.line2?.trim() || null,
      city: input.site.city.trim(),
      state: input.site.state.trim(),
      postalCode: input.site.postalCode.trim(),
    };

    if (
      !address.line1 ||
      !address.city ||
      !address.state ||
      !address.postalCode
    ) {
      return { ok: false, error: "Fill in the address before continuing." };
    }

    // A ZIP centroid, not a geocode. It is free and instant, and good enough to
    // rank stores by distance. A miss — a ZIP outside the seeded service area —
    // leaves the coordinates null and the flow simply stops showing distances.
    const zip = normalizeZip(address.postalCode);
    if (zip) {
      const { data: centroidData } = await supabase
        .from("zip_centroids")
        .select("lat, lng")
        .eq("zip", zip)
        .maybeSingle();

      centroid = centroidData as unknown as { lat: number; lng: number } | null;
    }

    // Reuse a site with the same address, so going back and forward — or a
    // retry after a failure — doesn't leave duplicates behind.
    const { data: existing } = await supabase
      .from("company_sites")
      .select("id")
      .eq("company_id", companyId)
      .eq("address_line1", address.line1)
      .eq("city", address.city)
      .eq("state", address.state)
      .eq("postal_code", address.postalCode)
      .limit(1);

    const match = (existing ?? [])[0] as { id: string } | undefined;

    if (match) {
      siteId = match.id;
    } else {
      const { data: created, error: siteError } = await supabase
        .from("company_sites")
        .insert({
          company_id: companyId,
          label: input.site.label?.trim() || address.line1,
          address_line1: address.line1,
          address_line2: address.line2,
          city: address.city,
          state: address.state,
          postal_code: address.postalCode,
          lat: centroid?.lat ?? null,
          lng: centroid?.lng ?? null,
        })
        .select("id")
        .single();

      if (siteError || !created) {
        return {
          ok: false,
          error: `Could not save that address: ${siteError?.message ?? "unknown error"}`,
        };
      }

      siteId = (created as unknown as { id: string }).id;
    }
  }

  const { data: intent, error: intentError } = await supabase
    .from("order_intents")
    .insert({
      company_id: companyId,
      created_by_profile_id: userId,
      site_id: siteId,
      delivery_address: address,
      retailer: input.retailer,
      retailer_store_id: storeId,
    })
    .select("id")
    .single();

  if (intentError || !intent) {
    // A new address stays saved even when this fails. It is a real site the
    // customer entered, and the customer has no delete policy to undo it with.
    return {
      ok: false,
      error: `Could not start the order: ${intentError?.message ?? "unknown error"}`,
    };
  }

  return { ok: true, intentId: (intent as unknown as { id: string }).id };
}

export type ZipCentroid = { lat: number; lng: number };

/**
 * Resolve a typed ZIP to its centroid.
 *
 * `saveOrderIntent` already looks the ZIP up when it stores the site, but that
 * is after the customer has chosen a store. The flow needs it *during* the
 * store step, so a brand-new address can be ranked by distance like a saved
 * one instead of falling back to alphabetical.
 *
 * Same source and same caveat as the intent path: a ZIP centroid is not the
 * address.
 */
export async function lookupZipCentroid(
  zip: string,
): Promise<ZipCentroid | null> {
  const { supabase } = await requireCustomer();

  const normalized = normalizeZip(zip);
  if (!normalized) return null;

  const { data } = await supabase
    .from("zip_centroids")
    .select("lat, lng")
    .eq("zip", normalized)
    .maybeSingle();

  return (data as unknown as ZipCentroid | null) ?? null;
}
