/**
 * What the review queue reads.
 *
 * Two shapes: a lightweight row for the left rail, and the full picture for the
 * order that is open. Everything a dispatcher verifies is assembled here so the
 * screen itself stays presentational.
 *
 * Reads go through the dispatcher's RLS-scoped client, so the database — not
 * this module — decides what a dispatcher may see.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { distanceMiles, type Point } from "@/lib/geo";
import { resolveRecipient } from "@/lib/intake/resolve-recipient";
import { selectParser } from "@/lib/parsers";
import { isRetailerId, RETAILERS } from "@/lib/retailers";

import { deliveryFields } from "./draft-input";
import { computeGates, type Gate } from "./gates";

/** How many alternatives to offer when the chosen store looks wrong. */
const ALTERNATIVES_SHOWN = 4;

export type QueueEntry = {
  id: string;
  orderNumber: string;
  status: string;
  retailerLabel: string;
  companyName: string;
  storeName: string | null;
  itemCount: number;
  materialsCents: number;
  createdAt: string;
  needsReview: boolean;
};

export type QueueItemRow = {
  id: string;
  lineNo: number;
  description: string;
  modelNumber: string | null;
  storeSku: string | null;
  quantity: number;
  imageUrl: string | null;
  /** The retailer's link for the item, from the original email. */
  productUrl: string | null;
};

export type StoreOption = {
  id: string;
  name: string;
  label: string | null;
  city: string | null;
  state: string | null;
  miles: number | null;
};

export type OrderDetail = {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    retailer: string;
    retailerLabel: string;
    materialsCents: number;
    sizingCents: number;
    mileageCents: number;
    taxCents: number;
    discountCents: number;
    totalCents: number;
    deliverySize: string | null;
    createdAt: string;
  };
  companyName: string;
  items: QueueItemRow[];
  email: {
    id: string;
    senderEmail: string;
    subject: string | null;
    receivedAt: string;
  } | null;
  parse: {
    strategy: string;
    succeeded: boolean;
    parserVersion: string | null;
    reason: string | null;
  } | null;
  delivery: {
    label: string | null;
    address: string | null;
    instructions: string | null;
    fields: ReturnType<typeof deliveryFields>;
  };
  /**
   * Who the checkout email will go to once there is one, or null when we have
   * no address for them. Sending for approval does not need it.
   */
  inviteRecipient: string | null;
  /**
   * True when an earlier prototype queued a checkout invite. Nothing sends it;
   * those orders were marked `awaiting_customer` without the customer hearing.
   */
  inviteQueued: boolean;
  store: StoreOption | null;
  storeOptions: StoreOption[];
  alternatives: StoreOption[];
  gates: Gate[];
};

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  retailer: string;
  company_id: string;
  retailer_store_id: string | null;
  materials_subtotal_cents: number;
  sizing_fee_cents: number;
  mileage_fee_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  delivery_size: string | null;
  delivery_address: unknown;
  delivery_instructions: string | null;
  site_id: string | null;
  requester_email: string | null;
  created_at: string;
  inbound_email_id: string | null;
};

function retailerLabel(retailer: string): string {
  return isRetailerId(retailer) ? RETAILERS[retailer].label : retailer;
}

function addressLines(address: unknown): string | null {
  if (!address || typeof address !== "object") return null;
  const value = address as Record<string, unknown>;
  const parts = [
    value.line1,
    value.line2,
    [value.city, value.state].filter(Boolean).join(", "),
    value.postalCode,
  ].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );

  return parts.length > 0 ? parts.join(" · ") : null;
}

/** The statuses that mean "a dispatcher still has something to do". */
const QUEUE_STATUSES = ["received", "needs_review"];

/**
 * The review page's list tabs: the queue itself, orders sent to the customer
 * for approval, and every order.
 */
export const QUEUE_VIEWS = ["review", "customer", "all"] as const;

export type QueueView = (typeof QUEUE_VIEWS)[number];

/** Null means every status. */
const VIEW_STATUSES: Record<QueueView, string[] | null> = {
  review: QUEUE_STATUSES,
  customer: ["awaiting_customer"],
  all: null,
};

/** How many orders one tab lists. */
export const VIEW_LIMIT = 50;

export function isQueueView(value: unknown): value is QueueView {
  return (QUEUE_VIEWS as readonly unknown[]).includes(value);
}

/** The tab an order belongs in, so the open order is in the list shown. */
export function viewForStatus(status: string): QueueView {
  if (QUEUE_STATUSES.includes(status)) return "review";
  if (status === "awaiting_customer") return "customer";
  return "all";
}

/** How many orders each tab holds — beyond the rows a tab lists. */
export async function countQueueViews(
  supabase: SupabaseClient,
): Promise<Record<QueueView, number>> {
  const counts = await Promise.all(
    QUEUE_VIEWS.map((view) => {
      const statuses = VIEW_STATUSES[view];
      const query = supabase
        .from("orders")
        .select("id", { count: "exact", head: true });
      return statuses ? query.in("status", statuses) : query;
    }),
  );

  return {
    review: counts[0].count ?? 0,
    customer: counts[1].count ?? 0,
    all: counts[2].count ?? 0,
  };
}

export async function listQueue(
  supabase: SupabaseClient,
  view: QueueView = "review",
): Promise<QueueEntry[]> {
  const statuses = VIEW_STATUSES[view];
  const base = supabase
    .from("orders")
    .select(
      "id, order_number, status, retailer, company_id, retailer_store_id, materials_subtotal_cents, created_at",
    );

  const { data: orderData } = await (
    statuses ? base.in("status", statuses) : base
  )
    // The two worklists run oldest first: the order that has waited longest is
    // the one a customer is most likely chasing. "All" is a record, so newest
    // first.
    .order("created_at", { ascending: view !== "all" })
    .limit(VIEW_LIMIT);

  const orders = (orderData ?? []) as OrderRow[];
  if (orders.length === 0) return [];

  const companyIds = [...new Set(orders.map((order) => order.company_id))];
  const storeIds = [
    ...new Set(
      orders
        .map((order) => order.retailer_store_id)
        .filter((id): id is string => id !== null),
    ),
  ];

  const [companiesResult, storesResult, itemsResult] = await Promise.all([
    supabase.from("companies").select("id, name").in("id", companyIds),
    storeIds.length > 0
      ? supabase.from("retailer_stores").select("id, name").in("id", storeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase
      .from("order_items")
      .select("order_id")
      .in(
        "order_id",
        orders.map((order) => order.id),
      ),
  ]);

  const companyNames = new Map(
    ((companiesResult.data ?? []) as { id: string; name: string }[]).map(
      (row) => [row.id, row.name],
    ),
  );
  const storeNames = new Map(
    ((storesResult.data ?? []) as { id: string; name: string }[]).map((row) => [
      row.id,
      row.name,
    ]),
  );

  const itemCounts = new Map<string, number>();
  for (const row of (itemsResult.data ?? []) as { order_id: string }[]) {
    itemCounts.set(row.order_id, (itemCounts.get(row.order_id) ?? 0) + 1);
  }

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    retailerLabel: retailerLabel(order.retailer),
    companyName: companyNames.get(order.company_id) ?? "Unknown company",
    storeName: order.retailer_store_id
      ? (storeNames.get(order.retailer_store_id) ?? null)
      : null,
    itemCount: itemCounts.get(order.id) ?? 0,
    materialsCents: order.materials_subtotal_cents,
    createdAt: order.created_at,
    needsReview: order.status === "needs_review",
  }));
}

export async function loadOrderDetail(
  supabase: SupabaseClient,
  orderId: string,
): Promise<OrderDetail | null> {
  const { data: orderData } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, retailer, company_id, retailer_store_id, materials_subtotal_cents, sizing_fee_cents, mileage_fee_cents, discount_cents, tax_cents, total_cents, delivery_size, delivery_address, delivery_instructions, site_id, requester_email, created_at, inbound_email_id",
    )
    .eq("id", orderId)
    .maybeSingle();

  const order = orderData as OrderRow | null;
  if (!order) return null;

  const [companyResult, itemsResult, emailResult, siteResult, inviteResult] =
    await Promise.all([
      supabase
        .from("companies")
        .select("name, billing_email")
        .eq("id", order.company_id)
        .maybeSingle(),
      supabase
        .from("order_items")
        .select(
          "id, line_no, description, model_number, store_sku, quantity, image_url, product_url",
        )
        .eq("order_id", order.id)
        .order("line_no", { ascending: true }),
      order.inbound_email_id
        ? supabase
            .from("inbound_emails")
            .select("id, sender_email, subject, received_at, body_html")
            .eq("id", order.inbound_email_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      order.site_id
        ? supabase
            .from("company_sites")
            .select("label, lat, lng")
            .eq("id", order.site_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("notifications")
        .select("id, status")
        .eq("order_id", order.id)
        .eq("template_key", "checkout_invite")
        .limit(1)
        .maybeSingle(),
    ]);

  const company = companyResult.data as {
    name: string;
    billing_email: string | null;
  } | null;

  const site = siteResult.data as {
    label: string | null;
    lat: number | null;
    lng: number | null;
  } | null;

  const sitePoint: Point | null =
    site && site.lat !== null && site.lng !== null
      ? { lat: site.lat, lng: site.lng }
      : null;

  const parse = order.inbound_email_id
    ? await loadParseAttempt(supabase, order.inbound_email_id)
    : null;

  const {
    chosen,
    alternatives,
    options: storeOptions,
  } = await loadStores(
    supabase,
    order.retailer,
    order.retailer_store_id,
    sitePoint,
  );

  const itemRows = (itemsResult.data ?? []) as {
    id: string;
    line_no: number;
    description: string;
    model_number: string | null;
    store_sku: string | null;
    quantity: number;
    image_url: string | null;
    product_url: string | null;
  }[];

  // Only orders finalized before 0012 lack stored links; parse the email for those.
  const links = itemRows.some((row) => !row.product_url)
    ? productLinks(
        emailResult.data as {
          sender_email: string;
          subject: string | null;
          body_html: string | null;
        } | null,
      )
    : new Map<string, string>();

  const items = itemRows.map((row) => ({
    id: row.id,
    lineNo: row.line_no,
    description: row.description,
    modelNumber: row.model_number,
    storeSku: row.store_sku,
    quantity: row.quantity,
    imageUrl: row.image_url,
    productUrl:
      row.product_url ??
      (row.store_sku ? (links.get(row.store_sku) ?? null) : null),
  }));

  const nearestMiles = alternatives.reduce<number | null>(
    (lowest, option) =>
      option.miles === null
        ? lowest
        : lowest === null || option.miles < lowest
          ? option.miles
          : lowest,
    null,
  );

  const fields = deliveryFields(
    order.delivery_address,
    order.delivery_instructions,
  );
  const gates = computeGates({
    parseSucceeded: parse?.succeeded ?? items.length > 0,
    itemCount: items.length,
    storeName: chosen?.name ?? null,
    storeMiles: chosen?.miles ?? null,
    nearestMiles,
    hasDeliveryAddress: Boolean(
      fields.line1 && fields.city && fields.state && fields.postalCode,
    ),
    hasSiteContact: Boolean(fields.contactName && fields.contactPhone),
    deliverySize: order.delivery_size,
    materialsCents: order.materials_subtotal_cents,
    totalCents: order.total_cents,
  });

  return {
    order: {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      retailer: order.retailer,
      retailerLabel: retailerLabel(order.retailer),
      materialsCents: order.materials_subtotal_cents,
      sizingCents: order.sizing_fee_cents,
      mileageCents: order.mileage_fee_cents,
      taxCents: order.tax_cents,
      discountCents: order.discount_cents,
      totalCents: order.total_cents,
      deliverySize: order.delivery_size,
      createdAt: order.created_at,
    },
    companyName: company?.name ?? "Unknown company",
    items,
    email: emailResult.data
      ? {
          id: (emailResult.data as { id: string }).id,
          senderEmail: (emailResult.data as { sender_email: string })
            .sender_email,
          subject: (emailResult.data as { subject: string | null }).subject,
          receivedAt: (emailResult.data as { received_at: string }).received_at,
        }
      : null,
    parse,
    delivery: {
      label: site?.label ?? null,
      address: addressLines(order.delivery_address),
      instructions: order.delivery_instructions,
      fields,
    },
    // The person who shared the cart is the one waiting on an answer, and their
    // address is the only one we know is live for this customer — the portal
    // user's email lives in `auth.users`, which needs the admin API to read.
    // `billing_email` is the fallback, not the first choice.
    inviteRecipient: order.requester_email ?? company?.billing_email ?? null,
    inviteQueued: inviteResult.data !== null,
    store: chosen,
    storeOptions,
    alternatives,
    gates,
  };
}

/**
 * Item links, read again from the stored email.
 *
 * The fallback for orders finalized before `order_items.product_url` existed
 * (0012). Keyed by the retailer's item number rather than line position.
 */
function productLinks(
  email: {
    sender_email: string;
    subject: string | null;
    body_html: string | null;
  } | null,
): Map<string, string> {
  const links = new Map<string, string>();
  if (!email?.body_html) return links;

  const result = selectParser(email.sender_email)?.parse({
    bodyHtml: email.body_html,
    subject: email.subject,
    senderEmail: email.sender_email,
  });
  if (!result?.ok) return links;

  for (const item of result.data.items) {
    if (item.storeSku && item.productUrl) {
      links.set(item.storeSku, item.productUrl);
    }
  }
  return links;
}

async function loadParseAttempt(
  supabase: SupabaseClient,
  inboundEmailId: string,
): Promise<OrderDetail["parse"]> {
  const { data } = await supabase
    .from("parse_attempts")
    .select("strategy, succeeded, parser_version, errors")
    .eq("inbound_email_id", inboundEmailId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = data as {
    strategy: string;
    succeeded: boolean;
    parser_version: string | null;
    errors: { reason?: string } | null;
  } | null;

  if (!row) return null;

  return {
    strategy: row.strategy,
    succeeded: row.succeeded,
    parserVersion: row.parser_version,
    reason: row.errors?.reason ?? null,
  };
}

/**
 * Every active store is selectable; the nearest alternatives are measured from
 * the saved job site when it has coordinates.
 *
 * Distances are null when the site has no coordinates — a typed address gets a
 * ZIP centroid, and a ZIP outside the seeded area gets nothing. The screen says
 * so rather than showing a fabricated number.
 */
async function loadStores(
  supabase: SupabaseClient,
  retailer: string,
  chosenId: string | null,
  sitePoint: Point | null,
): Promise<{
  chosen: StoreOption | null;
  alternatives: StoreOption[];
  options: StoreOption[];
}> {
  const { data, error } = await supabase
    .from("retailer_stores")
    .select("id, name, store_label, city, state, lat, lng")
    .eq("retailer", retailer)
    .eq("active", true);
  if (error) throw new Error("Could not load retailer stores");

  const rows = (data ?? []) as {
    id: string;
    name: string;
    store_label: string | null;
    city: string | null;
    state: string | null;
    lat: number | null;
    lng: number | null;
  }[];

  const options: StoreOption[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    label: row.store_label,
    city: row.city,
    state: row.state,
    miles:
      sitePoint && row.lat !== null && row.lng !== null
        ? distanceMiles(sitePoint, { lat: row.lat, lng: row.lng })
        : null,
  }));

  const chosen = options.find((option) => option.id === chosenId) ?? null;

  options.sort((a, b) => {
    if (a.miles === null && b.miles === null)
      return a.name.localeCompare(b.name);
    if (a.miles === null) return 1;
    if (b.miles === null) return -1;
    return a.miles - b.miles;
  });
  const alternatives = options
    .filter((option) => option.id !== chosenId)
    .slice(0, ALTERNATIVES_SHOWN);

  return { chosen, alternatives, options };
}

export type InboundException = {
  id: string;
  recipient: string;
  sender: string;
  subject: string | null;
  reason: string | null;
  companyId: string | null;
  companyName: string | null;
  receivedAt: string;
};

export async function listInboundExceptions(
  supabase: SupabaseClient,
): Promise<InboundException[]> {
  const { data, error } = await supabase
    .from("inbound_emails")
    .select(
      "id, recipient, sender_email, subject, review_reason, company_id, received_at",
    )
    .eq("review_status", "pending")
    .is("order_id", null)
    .order("received_at", { ascending: true })
    .limit(50);
  if (error) throw new Error(`Could not load inbound review: ${error.message}`);
  const rows = (data ?? []) as {
    id: string;
    recipient: string;
    sender_email: string;
    subject: string | null;
    review_reason: string | null;
    company_id: string | null;
    received_at: string;
  }[];
  const ids = [
    ...new Set(
      rows
        .map((row) => row.company_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: companies, error: companyError } = ids.length
    ? await supabase.from("companies").select("id, name").in("id", ids)
    : { data: [], error: null };
  if (companyError)
    throw new Error(`Could not load companies: ${companyError.message}`);
  const names = new Map(
    ((companies ?? []) as { id: string; name: string }[]).map((row) => [
      row.id,
      row.name,
    ]),
  );
  return rows.map((row) => ({
    id: row.id,
    recipient: row.recipient,
    sender: row.sender_email,
    subject: row.subject,
    reason: row.review_reason,
    companyId: row.company_id,
    companyName: row.company_id ? (names.get(row.company_id) ?? null) : null,
    receivedAt: row.received_at,
  }));
}

export async function loadInboundIntentPreview(
  supabase: SupabaseClient,
  recipient: string,
  domain: string | undefined,
) {
  const resolution = await resolveRecipient(supabase, recipient, domain);
  if (resolution.kind !== "intent") return null;
  const intent = resolution.intent;
  if (intent.status !== "open" || intent.retailer !== "lowes") {
    return {
      companyId: resolution.companyId,
      eligible: false,
      store: null,
      site: null,
      address: null,
    };
  }
  const [storeResult, siteResult] = await Promise.all([
    intent.retailer_store_id
      ? supabase
          .from("retailer_stores")
          .select("name")
          .eq("id", intent.retailer_store_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    intent.site_id
      ? supabase
          .from("company_sites")
          .select("label")
          .eq("id", intent.site_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (storeResult.error || siteResult.error)
    throw new Error("Could not load saved intent details");
  return {
    companyId: resolution.companyId,
    eligible: true,
    store: (storeResult.data as { name: string } | null)?.name ?? null,
    site: (siteResult.data as { label: string | null } | null)?.label ?? null,
    address: addressLines(intent.delivery_address),
  };
}
