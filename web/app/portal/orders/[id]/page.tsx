/**
 * One order, as the customer sees it.
 *
 * The items as we read them from the cart, where they are bought and
 * delivered, and the estimated price. Lowe's prints no prices, so materials is
 * a single estimate from Lowe's checkout rather than a price per line. Nothing
 * adjusts the total from the receipt yet, so the page does not promise it.
 *
 * While the order awaits approval, the customer confirms the on-site contact
 * and instructions — the only delivery details they may change — and approves
 * it here.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ApproveOrder } from "@/components/portal/approve-order";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import {
  loadCustomerOrder,
  portalStatusLabel,
  type CustomerOrder,
} from "@/lib/portal/order";
import { JOB_STEPS } from "@/lib/driver/steps";
import { formatPhone } from "@/lib/phone";
import {
  loadDeliveryProgress,
  type DeliveryProgress,
} from "@/lib/portal/progress";
import { createClient } from "@/lib/supabase/server";
import { orderStatusLabel, orderStatusTone } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Order",
};

const UUID = /^[0-9a-f-]{36}$/i;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const shortDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

const stamp = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** From posting to drivers through delivery: where the progress card shows. */
const DELIVERY_STAGES = [
  "driver_requested",
  "driver_assigned",
  "driver_at_store",
  "items_purchased",
  "en_route",
  "delivered",
];

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="px-4 py-3.5">
      <h2 className="text-[12px] font-semibold tracking-widest text-ink-faint uppercase">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </Card>
  );
}

function ItemsCard({ order }: { order: CustomerOrder }) {
  return (
    <SectionCard title={`Items · ${order.items.length}`}>
      <ul className="divide-y divide-hairline-soft">
        {order.items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="text-[15px] leading-snug font-medium text-ink">
                {item.productUrl ? (
                  <a
                    href={item.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-hairline underline-offset-2 transition-colors hover:text-accent hover:decoration-current"
                  >
                    {item.description}
                  </a>
                ) : (
                  item.description
                )}
              </div>
              <div className="mt-0.5 text-[13px] text-ink-faint">
                {item.storeSku ? `Item #${item.storeSku}` : null}
                {item.storeSku && item.modelNumber ? " · " : null}
                {item.modelNumber ? `Model #${item.modelNumber}` : null}
              </div>
            </div>
            <span className="shrink-0 text-[15px] font-semibold text-ink tabular-nums">
              {item.quantity}×
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function PlacesCards({
  order,
  approving,
}: {
  order: CustomerOrder;
  /** The approve form below holds the contact and instructions, so these leave them out. */
  approving: boolean;
}) {
  const { delivery } = order;
  const street = [delivery.line1, delivery.line2].filter(Boolean).join(", ");
  const town = [
    [delivery.city, delivery.state].filter(Boolean).join(", "),
    delivery.postalCode,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SectionCard title="Pick up at">
        <div className="text-[15px] font-medium text-ink">
          {order.retailerLabel}
          {order.store ? ` · ${order.store.name}` : null}
        </div>
        {order.store?.city ? (
          <div className="mt-0.5 text-[13.5px] text-ink-muted">
            {[order.store.city, order.store.state].filter(Boolean).join(", ")}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Deliver to">
        <div className="text-[15px] font-medium text-ink">
          {order.siteLabel ?? "Job site"}
        </div>
        <div className="mt-0.5 text-[13.5px] leading-relaxed text-ink-muted">
          {street || town ? (
            <>
              {street ? <div>{street}</div> : null}
              {town ? <div>{town}</div> : null}
            </>
          ) : (
            "No address yet"
          )}
        </div>
        {!approving && (delivery.contactName || delivery.contactPhone) ? (
          <div className="mt-2 text-[13.5px] text-ink-muted">
            <span className="text-ink-faint">On-site contact</span>{" "}
            {[
              delivery.contactName,
              delivery.contactPhone ? formatPhone(delivery.contactPhone) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        ) : null}
        {!approving && delivery.instructions ? (
          <p className="mt-2 border-t border-hairline-soft pt-2 text-[13.5px] leading-relaxed text-ink-muted">
            {delivery.instructions}
          </p>
        ) : null}
      </SectionCard>
    </div>
  );
}

/** Where the driver has got to, and the photo of the delivered materials. */
function ProgressCard({ progress }: { progress: DeliveryProgress }) {
  const rows = [
    {
      key: "driver_requested",
      label: orderStatusLabel.driver_requested,
      at: progress.postedAt,
    },
    ...(["driver_assigned", ...JOB_STEPS.map((step) => step.to)] as const).map(
      (status) => ({
        key: status,
        label: orderStatusLabel[status],
        at: progress.reachedAt[status] ?? null,
      }),
    ),
  ];
  const photo = progress.photos[0];

  return (
    <SectionCard title="Delivery progress">
      <ol>
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2.5 py-1.5">
            {row.at ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-ink">
                <CheckIcon className="h-3 w-3" />
              </span>
            ) : (
              <span className="h-5 w-5 shrink-0 rounded-full border border-hairline" />
            )}
            <span
              className={cn(
                "min-w-0 flex-1 text-[14px]",
                row.at ? "text-ink" : "text-ink-faint",
              )}
            >
              {row.label}
            </span>
            {row.at ? (
              <span className="shrink-0 text-[12.5px] text-ink-faint tabular-nums">
                {stamp.format(new Date(row.at))}
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      {photo ? (
        <div className="mt-3 border-t border-hairline-soft pt-3">
          <div className="text-[13.5px] font-medium text-ink">
            Delivery photo
          </div>
          <a
            href={photo.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block overflow-hidden rounded-field border border-hairline bg-card-muted"
          >
            {/* Redirects to a freshly signed URL in private storage, which
                next/image cannot optimize. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt="The delivered materials, open full size"
              className="max-h-96 w-full object-cover text-[13px] text-ink-muted"
            />
          </a>
        </div>
      ) : null}
    </SectionCard>
  );
}

function PriceRow({
  label,
  hint,
  cents,
}: {
  label: string;
  hint?: string;
  cents: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-[14px]">
      <span className="text-ink-muted">
        {label}
        {hint ? (
          <span className="ml-1.5 text-[12.5px] text-ink-faint">{hint}</span>
        ) : null}
      </span>
      <span className="text-ink tabular-nums">{money.format(cents / 100)}</span>
    </div>
  );
}

function PriceCard({ order }: { order: CustomerOrder }) {
  const { price } = order;

  return (
    <SectionCard title="Estimated price">
      {price.totalCents > 0 ? (
        <>
          <PriceRow
            label="Materials"
            hint={`${order.retailerLabel} estimate`}
            cents={price.materialsCents}
          />
          <PriceRow label="Sizing fee" cents={price.sizingCents} />
          <PriceRow label="Mileage fee" cents={price.mileageCents} />
          {price.discountCents > 0 ? (
            <PriceRow label="Discount" cents={-price.discountCents} />
          ) : null}
          {price.taxCents > 0 ? (
            <PriceRow label="Tax" cents={price.taxCents} />
          ) : null}
          <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-hairline-soft pt-2.5">
            <span className="text-[15px] font-semibold text-ink">
              Estimated total
            </span>
            <span className="text-[16px] font-semibold text-ink tabular-nums">
              {money.format(price.totalCents / 100)}
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
            This is an estimate. {order.retailerLabel} prices can change before
            the driver buys your items.
          </p>
        </>
      ) : (
        <p className="text-[14px] text-ink-muted">Not priced yet.</p>
      )}
    </SectionCard>
  );
}

export default async function PortalOrderPage(
  props: PageProps<"/portal/orders/[id]">,
) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const order = await loadCustomerOrder(supabase, id);
  if (!order) notFound();

  const store = order.store ? ` · ${order.store.name}` : "";
  const approving = order.status === "awaiting_customer";
  const progress = DELIVERY_STAGES.includes(order.status)
    ? await loadDeliveryProgress(supabase, order.id)
    : null;

  return (
    <div>
      <Link
        href="/portal/orders"
        className="text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink"
      >
        ← Orders
      </Link>

      <PageHeader
        className="mt-3"
        title={`Order ${order.orderNumber}`}
        description={`${order.retailerLabel}${store} · ${shortDate.format(new Date(order.createdAt))}`}
        actions={
          <Badge tone={orderStatusTone[order.status]} bordered>
            {portalStatusLabel(order.status)}
          </Badge>
        }
      />

      <div className="mt-5 space-y-3">
        {order.customerConfirmedAt ? (
          <div className="flex items-center gap-2 rounded-card bg-success-bg px-4 py-3 text-[14px] font-medium text-success-ink">
            <CheckIcon className="h-4 w-4 shrink-0" />
            <span>
              You approved this order on{" "}
              {shortDate.format(new Date(order.customerConfirmedAt))}.
            </span>
          </div>
        ) : null}
        {progress ? <ProgressCard progress={progress} /> : null}
        <ItemsCard order={order} />
        <PlacesCards order={order} approving={approving} />
        <PriceCard order={order} />
        {approving ? (
          <ApproveOrder
            orderId={order.id}
            retailerLabel={order.retailerLabel}
            totalLabel={money.format(order.price.totalCents / 100)}
            contactName={order.delivery.contactName}
            contactPhone={order.delivery.contactPhone}
            instructions={order.delivery.instructions}
          />
        ) : null}
      </div>
    </div>
  );
}
