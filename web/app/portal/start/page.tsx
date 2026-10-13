import type { Metadata } from "next";

import { StartOrderFlow } from "@/components/portal/start/start-order-flow";
import type { FlowSite, FlowStore } from "@/components/portal/start/types";
import { Card } from "@/components/ui/card";
import { isInboundAddressReady } from "@/lib/mailgun/config";
import { isRetailerId } from "@/lib/retailers";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Start an order",
};

type SiteRow = {
  id: string;
  label: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
};

type StoreRow = {
  id: string;
  retailer: string;
  name: string;
  store_label: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
  store_url: string | null;
  phone: string | null;
};

export default async function PortalStartPage() {
  if (!isInboundAddressReady()) {
    return (
      <Card className="p-6">
        <h1 className="text-[15px] font-semibold text-ink">
          Cart email intake is not ready yet
        </h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
          Ask the dispatcher to confirm your company&apos;s new Mailgun address
          before sharing a cart. The old Gmail address does not reach this app.
        </p>
      </Card>
    );
  }

  const supabase = await createClient();

  const [sitesResult, storesResult] = await Promise.all([
    supabase
      .from("company_sites")
      .select(
        "id, label, address_line1, address_line2, city, state, postal_code, lat, lng, is_default",
      )
      .order("is_default", { ascending: false })
      .order("label"),
    supabase
      .from("retailer_stores")
      .select(
        "id, retailer, name, store_label, address_line1, city, state, postal_code, lat, lng, store_url, phone",
      )
      .eq("active", true)
      .order("name"),
  ]);

  // Every query here runs through RLS on the customer's own session, so the
  // rows are already scoped to their company.
  const sites: FlowSite[] = (
    (sitesResult.data ?? []) as unknown as SiteRow[]
  ).map((row) => ({
    id: row.id,
    label: row.label,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    lat: row.lat,
    lng: row.lng,
    isDefault: row.is_default,
  }));

  const stores: FlowStore[] = (
    (storesResult.data ?? []) as unknown as StoreRow[]
  )
    .filter((row) => isRetailerId(row.retailer))
    .map((row) => ({
      id: row.id,
      retailer: row.retailer as FlowStore["retailer"],
      name: row.name,
      storeLabel: row.store_label,
      addressLine1: row.address_line1,
      city: row.city,
      state: row.state,
      postalCode: row.postal_code,
      lat: row.lat,
      lng: row.lng,
      storeUrl: row.store_url,
      phone: row.phone,
    }));

  // The receiving domain is checked above. The final address comes from the
  // saved intent, not the company's stable email-only alias.

  if (sitesResult.error || storesResult.error) {
    return (
      <Card className="p-6">
        <h1 className="text-[15px] font-semibold text-ink">
          Could not load the order flow
        </h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
          {sitesResult.error?.message ?? storesResult.error?.message}
        </p>
      </Card>
    );
  }

  // Without at least one store there is nothing to pick up from, and the
  // retailer step would be empty.
  if (stores.length === 0) {
    return (
      <Card className="p-6">
        <h1 className="text-[15px] font-semibold text-ink">
          No stores are set up yet
        </h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
          We&apos;re still adding the stores we buy from. Get in touch and
          we&apos;ll get you started.
        </p>
      </Card>
    );
  }

  return <StartOrderFlow sites={sites} stores={stores} />;
}
