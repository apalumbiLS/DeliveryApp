import type { RetailerId } from "@/lib/retailers";

export type FlowSite = {
  id: string;
  label: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
};

export type FlowStore = {
  id: string;
  retailer: RetailerId;
  name: string;
  /** The retailer's own wording for the store, shown in "Check your store". */
  storeLabel: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
  storeUrl: string | null;
  phone: string | null;
};

export type RankedStore = { store: FlowStore; miles: number | null };

export type NewAddressDraft = {
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
};

export const EMPTY_ADDRESS: NewAddressDraft = {
  label: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
};

export function isAddressComplete(address: NewAddressDraft) {
  return Boolean(
    address.line1.trim() &&
    address.city.trim() &&
    address.state.trim() &&
    address.postalCode.trim(),
  );
}

/** "421 Commerce Rd, Bldg 3 · Charlotte, NC 28202", skipping what's missing. */
export function formatAddress(parts: {
  addressLine1: string | null;
  addressLine2?: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}) {
  const street = [parts.addressLine1, parts.addressLine2]
    .filter(Boolean)
    .join(", ");
  const locality = [
    parts.city,
    [parts.state, parts.postalCode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return [street, locality].filter(Boolean).join(" · ");
}
