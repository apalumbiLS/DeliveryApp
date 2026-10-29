/**
 * The review queue, with one order open.
 *
 * This is the dispatcher's whole job: verify that we read the customer's cart
 * correctly, confirm where it is going, price it, and only then send it to the
 * customer for approval. Every band below is one verification step, and the
 * gate bar at the bottom names whatever is still blocking.
 *
 * Built from the approved mockup direction — `app/mockups/dispatch/review-queue.tsx`
 * — and composed from the same `components/console/` primitives the mockup uses.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Band } from "@/components/console/band";
import { CheckDot } from "@/components/console/check-row";
import {
  DeliveryEditPanel,
  DeliveryEditProvider,
  DeliveryEditToggle,
} from "@/components/console/delivery-edit";
import { DraftForm, DraftSaveButton } from "@/components/console/draft-form";
import { IntroDialog } from "@/components/console/intro-dialog";
import { QUEUE_VIEW_EMPTY, QueueTabs } from "@/components/console/queue-tabs";
import { InboundExceptionList } from "@/components/console/inbound-exception-list";
import {
  SizePicker,
  type DeliverySize,
} from "@/components/console/size-picker";
import { Td, Th } from "@/components/console/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertIcon, CheckIcon, TagIcon } from "@/components/ui/icons";
import {
  sendForApproval,
  updateOrderDelivery,
  updateOrderQuote,
  updateOrderStore,
} from "@/lib/dispatch/actions";
import { blockingGate, type Gate } from "@/lib/dispatch/gates";
import {
  countQueueViews,
  isQueueView,
  listInboundExceptions,
  listQueue,
  loadOrderDetail,
  viewForStatus,
  type InboundException,
  type OrderDetail,
  type QueueEntry,
  type QueueView,
} from "@/lib/dispatch/review-queue";
import { requireDispatcher } from "@/lib/dispatch/require-dispatcher";
import { formatDistance } from "@/lib/geo";
import {
  orderStatusLabel,
  orderStatusTone,
  type OrderStatus,
} from "@/lib/tokens";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function shortAge(iso: string): string {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / (60 * 24))}d`;
}

/** What a row says about its order: the reading for the queue, the status after. */
function entryBadge(entry: QueueEntry) {
  if (entry.needsReview) {
    return { tone: "danger" as const, text: "Could not read" };
  }
  if (entry.status === "received") {
    return { tone: "info" as const, text: "Ready to verify" };
  }
  const status = entry.status as OrderStatus;
  return {
    tone: orderStatusTone[status] ?? "neutral",
    text: orderStatusLabel[status] ?? entry.status,
  };
}

function QueueRail({
  view,
  counts,
  queue,
  exceptions,
  selectedId,
}: {
  view: QueueView;
  counts: Record<QueueView, number>;
  queue: QueueEntry[];
  exceptions: InboundException[];
  selectedId: string;
}) {
  // Only "All" is kept on the order links. The other two follow the order's
  // own status, so an order that moves on — sent for approval, say — is still
  // in the list it is shown with.
  const suffix = view === "all" ? "?view=all" : "";

  return (
    <div className="w-60 shrink-0 border-r border-hairline-soft">
      <QueueTabs
        view={view}
        counts={counts}
        hrefFor={(option) => `/dispatch/review/${selectedId}?view=${option}`}
      />
      {queue.length === 0 ? (
        <p className="border-t border-hairline-soft px-4 py-3 text-[11.5px] text-ink-faint">
          {QUEUE_VIEW_EMPTY[view]}
        </p>
      ) : null}
      <ul>
        {queue.map((entry) => {
          const selected = entry.id === selectedId;
          return (
            <li
              key={entry.id}
              className={cn(
                "border-t border-hairline-soft",
                selected && "bg-accent-soft",
              )}
            >
              {/* Every row carries the left bar, transparent unless selected, so
                selecting one does not shift its text. */}
              <Link
                href={`/dispatch/review/${entry.id}${suffix}`}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "block border-l-3 px-4 py-2.5 transition-colors",
                  selected
                    ? "border-accent"
                    : "border-transparent hover:bg-card-muted",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-[12.5px] tabular-nums",
                      selected
                        ? "font-semibold text-accent-soft-ink"
                        : "font-medium",
                    )}
                  >
                    {entry.orderNumber}
                  </span>
                  <span className="text-[11px] text-ink-faint tabular-nums">
                    {shortAge(entry.createdAt)}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-ink-muted">
                  {entry.companyName} · {entry.retailerLabel}
                </div>
                <div className="mt-1 truncate text-[11.5px] text-ink">
                  {entry.storeName ?? "No store"}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Badge tone={entryBadge(entry).tone} bordered>
                    {entryBadge(entry).text}
                  </Badge>
                  <span className="truncate text-[11px] text-ink-faint">
                    {entry.itemCount} item{entry.itemCount === 1 ? "" : "s"}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {view === "all" && counts.all > queue.length ? (
        <p className="border-t border-hairline-soft px-4 py-3 text-[11px] text-ink-faint">
          Newest {queue.length} of {counts.all}.
        </p>
      ) : null}
      {view === "review" ? <InboundExceptionList entries={exceptions} /> : null}
    </div>
  );
}

function ItemsBand({
  detail,
  orderId,
}: {
  detail: OrderDetail;
  orderId: string;
}) {
  const failed = detail.parse !== null && !detail.parse.succeeded;

  return (
    <Band
      title="1 · Verify the items"
      status={
        <Badge tone={failed ? "danger" : "info"} bordered>
          {failed ? "Could not read the cart" : `${detail.items.length} lines`}
        </Badge>
      }
    >
      {/* The email column is as wide as its resizable preview; `w-0 min-w-full`
          keeps the text around it from widening the column on its own. */}
      <div className="@container">
        <div className="flex flex-col gap-3 @3xl:flex-row">
          <div className="max-w-full min-w-0 @3xl:max-w-[calc(100%-16rem)]">
            <div className="w-0 min-w-full rounded-field border border-hairline bg-card-muted px-2.5 py-2">
              <div className="truncate text-[11.5px] font-medium">
                {detail.email?.senderEmail ?? "Unknown sender"}
              </div>
              <div className="mt-0.5 truncate text-[10.5px] text-ink-faint">
                {detail.email?.subject ?? "no subject"}
              </div>
            </div>

            {detail.email ? (
              // Resizable from its bottom-right corner. The strip under the frame
              // is where that corner sits, so the drag never starts on the email.
              <div className="mt-2 flex h-120 min-h-60 w-136 max-w-full min-w-60 resize flex-col overflow-hidden rounded-field border border-hairline bg-white">
                {/* The sandbox is the strongest of the four layers around this
                    HTML: no scripts, no forms, opaque origin. Links may open a
                    new tab, outside it. The route adds a locked CSP and a
                    sanitizer behind that. */}
                <iframe
                  src={`/dispatch/email/${orderId}`}
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                  title="The cart email, as the retailer sent it"
                  className="min-h-0 w-full flex-1"
                />
                <div
                  aria-hidden
                  className="h-3.5 shrink-0 border-t border-hairline-soft bg-card-muted"
                />
              </div>
            ) : (
              <p className="mt-2 w-136 max-w-full rounded-field bg-warning-bg px-2.5 py-2 text-[11.5px] leading-relaxed text-warning-ink">
                The original email is not attached to this order.
              </p>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {detail.items.length === 0 ? (
              <p className="rounded-field bg-danger-bg px-2.5 py-2 text-[11.5px] leading-relaxed text-danger-ink">
                No lines were read from this cart.
              </p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-hairline-soft">
                    <Th>Read from the email</Th>
                    <Th className="w-12 text-right">Qty</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-soft">
                  {detail.items.map((item) => (
                    <tr key={item.id}>
                      <Td>
                        <div className="truncate text-[12px] text-ink">
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
                        <div className="mt-0.5 text-[10.5px] text-ink-faint">
                          {item.storeSku ? `Item #${item.storeSku}` : null}
                          {item.storeSku && item.modelNumber ? " · " : null}
                          {item.modelNumber
                            ? `Model #${item.modelNumber}`
                            : null}
                        </div>
                      </Td>
                      <Td className="text-right text-[12px] tabular-nums">
                        {item.quantity}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {failed && detail.parse?.reason ? (
              <div className="mt-2 flex items-start gap-2 rounded-control bg-danger-bg px-2.5 py-2">
                <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger-ink" />
                <p className="text-[11.5px] leading-relaxed text-danger-ink">
                  {detail.parse.reason}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Band>
  );
}

const LOWES_PRICING_STEPS: ReactNode[] = [
  "Empty your Lowe's cart.",
  <>
    Click <strong className="font-semibold">Add all to cart</strong> in the
    email.
  </>,
  <>
    Click <strong className="font-semibold">Start secure checkout</strong>.
  </>,
  "Enter the estimated total under Materials.",
];

function LowesPricingStepList({ stacked = false }: { stacked?: boolean }) {
  return (
    <ol className={stacked ? "space-y-2.5" : "flex flex-wrap gap-x-5 gap-y-2"}>
      {LOWES_PRICING_STEPS.map((step, index) => (
        <li
          key={index}
          className={cn(
            "flex items-start leading-snug text-ink",
            stacked ? "gap-2.5 text-[13px]" : "gap-1.5 text-[12px]",
          )}
        >
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full font-semibold text-info-ink tabular-nums ring-1 ring-info/30",
              stacked
                ? "h-5 w-5 bg-info-bg text-[11px]"
                : "h-4.5 w-4.5 bg-card text-[10.5px]",
            )}
          >
            {index + 1}
          </span>
          <span className="min-w-0">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function PricingMark() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-info text-accent-ink">
      <TagIcon className="h-4 w-4" />
    </div>
  );
}

/**
 * Lowe's emails carry no prices, so the dispatcher reads the materials cost off
 * Lowe's own checkout. It opens as a briefing the dispatcher must dismiss, then
 * stays first on the page for reference, because it is the one step that
 * happens outside the console.
 */
function LowesPricingSteps() {
  return (
    <>
      <IntroDialog
        storageKey="materials-delivered:lowes-pricing-intro-hidden"
        title="Price it at Lowe's"
        icon={<PricingMark />}
      >
        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          Lowe&apos;s emails don&apos;t include prices, so get the materials
          cost from Lowe&apos;s checkout.
        </p>
        <div className="mt-3.5">
          <LowesPricingStepList stacked />
        </div>
        <p className="mt-3.5 text-[11.5px] text-ink-faint">
          These steps stay at the top of the page.
        </p>
      </IntroDialog>

      <section className="mb-3 flex items-start gap-3 rounded-card border border-info/30 bg-info-bg px-3.5 py-3">
        <PricingMark />
        <div className="min-w-0 flex-1">
          <h2 className="text-[12.5px] font-semibold text-info-ink">
            Price it at Lowe&apos;s
          </h2>
          <div className="mt-2">
            <LowesPricingStepList />
          </div>
        </div>
      </section>
    </>
  );
}

/** The delivery fields an order cannot go out without, as the card names them. */
const REQUIRED_DELIVERY_FIELDS = [
  ["line1", "street address"],
  ["city", "city"],
  ["state", "state"],
  ["postalCode", "ZIP code"],
  ["contactName", "on-site contact"],
  ["contactPhone", "contact phone"],
] as const;

function DeliveryBand({
  detail,
  orderId,
}: {
  detail: OrderDetail;
  orderId: string;
}) {
  const storeGate = detail.gates.find((gate) => gate.key === "store");
  const addressGate = detail.gates.find((gate) => gate.key === "address");
  const { fields } = detail.delivery;
  const missing = REQUIRED_DELIVERY_FIELDS.filter(([key]) => !fields[key]).map(
    ([, label]) => label,
  );

  return (
    <Band
      title="2 · Verify the delivery & price"
      status={
        storeGate?.state === "warn" ? (
          <Badge tone="warning" bordered>
            Store looks far
          </Badge>
        ) : null
      }
    >
      <DeliveryEditProvider defaultOpen={addressGate?.state !== "pass"}>
        <div className="grid grid-cols-[minmax(0,13rem)_minmax(0,15rem)_minmax(0,1fr)] gap-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] font-medium text-ink-muted">
                Deliver to
              </span>
              <DeliveryEditToggle />
            </div>
            <div
              className={cn(
                "mt-1.5 rounded-field border bg-card-muted px-2.5 py-2",
                missing.length > 0 ? "border-warning/60" : "border-hairline",
              )}
            >
              <div className="text-[12px] font-medium">
                {detail.delivery.label ?? "Job site"}
              </div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
                {detail.delivery.address ?? "No address captured"}
              </div>
              {fields.contactName ? (
                <div className="mt-1 text-[11px] text-ink-muted">
                  {fields.contactName} · {fields.contactPhone}
                </div>
              ) : null}
              {detail.delivery.instructions ? (
                <div className="mt-1.5 border-t border-hairline-soft pt-1.5 text-[10.5px] leading-relaxed text-ink-faint">
                  {detail.delivery.instructions}
                </div>
              ) : null}
              {missing.length > 0 ? (
                <div className="mt-1.5 flex items-start gap-1.5 rounded-control bg-warning-bg px-2 py-1.5">
                  <AlertIcon className="mt-0.5 h-3 w-3 shrink-0 text-warning-ink" />
                  <p className="text-[10.5px] leading-relaxed text-warning-ink">
                    Missing: {missing.join(", ")}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <DraftForm
            action={updateOrderStore}
            savedKey={detail.store?.id ?? "none"}
            messages={{
              invalid: "Choose a Lowe's store before saving.",
              error: "Store was not saved. Refresh and try again.",
            }}
          >
            <input type="hidden" name="orderId" value={orderId} />
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11.5px] font-medium text-ink-muted">
                Store
              </span>
              <span className="text-[10.5px] text-ink-faint">
                nearest if known
              </span>
            </div>

            <div className="mt-1.5 rounded-field border border-hairline bg-card px-2.5 py-2">
              <div className="truncate text-[12px] font-medium">
                {detail.store?.name ?? "No store chosen"}
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2 text-[10.5px] text-ink-faint">
                <span>{detail.store ? "selected store" : "pick one"}</span>
                <span className="tabular-nums">
                  {detail.store?.miles != null
                    ? formatDistance(detail.store.miles)
                    : "—"}
                </span>
              </div>
            </div>

            <label
              htmlFor="storeId"
              className="mt-2 block text-[10.5px] text-ink-faint"
            >
              Change store
            </label>
            <select
              id="storeId"
              name="storeId"
              defaultValue={detail.store?.id ?? ""}
              className="mt-1 w-full rounded-control border border-hairline bg-card px-2 py-1.5 text-[11.5px] text-ink"
            >
              <option value="" disabled>
                Choose a store
              </option>
              {detail.storeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label ?? option.name}
                  {option.miles != null
                    ? ` — ${option.miles.toFixed(1)} mi`
                    : ""}
                </option>
              ))}
            </select>

            <DraftSaveButton label="Save store" className="mt-2" />

            {storeGate?.state === "warn" ? (
              <div className="mt-1.5 flex items-start gap-1.5 rounded-control bg-warning-bg px-2 py-1.5">
                <AlertIcon className="mt-0.5 h-3 w-3 shrink-0 text-warning-ink" />
                <p className="text-[10.5px] leading-relaxed text-warning-ink">
                  {storeGate.detail}
                </p>
              </div>
            ) : null}
          </DraftForm>

          <DraftForm
            action={updateOrderQuote}
            savedKey={[
              detail.order.deliverySize,
              detail.order.materialsCents,
              detail.order.sizingCents,
              detail.order.mileageCents,
            ].join(":")}
            messages={{
              invalid: "Pick a size and enter valid dollar amounts.",
              error: "Pricing was not saved. Refresh and try again.",
            }}
          >
            <input type="hidden" name="orderId" value={orderId} />
            <span className="text-[11.5px] font-medium text-ink-muted">
              Delivery size
            </span>

            <div className="mt-1.5">
              <SizePicker
                name="deliverySize"
                selected={
                  (detail.order.deliverySize as DeliverySize | null) ?? null
                }
              />
            </div>

            <div className="mt-2.5 border-t border-hairline-soft pt-1.5">
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-[11.5px] text-ink-muted">
                  Materials
                  <span className="ml-1.5 text-[10.5px] text-ink-faint">
                    from Lowe&apos;s checkout
                  </span>
                </span>
                <input
                  name="materials"
                  inputMode="decimal"
                  defaultValue={
                    detail.order.materialsCents
                      ? dollars(detail.order.materialsCents)
                      : ""
                  }
                  placeholder="Not priced"
                  className="w-20 rounded-control border border-hairline bg-card px-2 py-1 text-right text-[12px] tabular-nums"
                />
              </div>

              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-[11.5px] text-ink-muted">Sizing fee</span>
                <input
                  name="sizing"
                  inputMode="decimal"
                  defaultValue={dollars(detail.order.sizingCents)}
                  className="w-20 rounded-control border border-hairline bg-card px-2 py-1 text-right text-[12px] tabular-nums"
                />
              </div>

              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-[11.5px] text-ink-muted">
                  Mileage fee
                </span>
                <input
                  name="mileage"
                  inputMode="decimal"
                  defaultValue={dollars(detail.order.mileageCents)}
                  className="w-20 rounded-control border border-hairline bg-card px-2 py-1 text-right text-[12px] tabular-nums"
                />
              </div>

              <div className="mt-1 flex items-center justify-between border-t border-hairline-soft pt-1.5">
                <span className="text-[12px] font-semibold text-ink">
                  Total
                </span>
                <span className="text-[14px] font-semibold text-ink tabular-nums">
                  {money.format(detail.order.totalCents / 100)}
                </span>
              </div>

              <DraftSaveButton label="Save size & price" className="mt-2" />

              <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-faint">
                Fees are entered by hand until the pricing model is settled.
              </p>
            </div>
          </DraftForm>
        </div>

        <DeliveryEditPanel>
          <DraftForm
            action={updateOrderDelivery}
            savedKey={JSON.stringify(fields)}
            messages={{
              invalid: "Enter a complete address and on-site contact.",
              error: "Delivery details were not saved. Refresh and try again.",
            }}
            className="mt-3 border-t border-hairline-soft pt-3"
          >
            <input type="hidden" name="orderId" value={orderId} />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["line1", "Street address", fields.line1],
                  ["line2", "Suite / building (optional)", fields.line2],
                  ["city", "City", fields.city],
                  ["state", "State", fields.state],
                  ["postalCode", "ZIP code", fields.postalCode],
                  ["contactName", "On-site contact", fields.contactName],
                  ["contactPhone", "Contact phone", fields.contactPhone],
                ] as const
              ).map(([name, label, value]) => (
                // A required field that is still empty is `:invalid`, so the
                // highlight clears as soon as it is filled in, before saving.
                <label
                  key={name}
                  className="group text-[11px] text-ink-muted has-[:invalid]:text-warning-ink"
                >
                  {label}
                  <span className="ml-1 hidden font-medium group-has-[:invalid]:inline">
                    · missing
                  </span>
                  <input
                    name={name}
                    defaultValue={value}
                    required={name !== "line2"}
                    type={name === "contactPhone" ? "tel" : "text"}
                    className="mt-1 block w-full rounded-control border border-hairline bg-card px-2 py-1.5 text-[12px] text-ink invalid:border-warning invalid:bg-warning-bg"
                  />
                </label>
              ))}
              <label className="text-[11px] text-ink-muted sm:col-span-2 lg:col-span-3">
                Delivery instructions (optional)
                <textarea
                  name="instructions"
                  defaultValue={fields.instructions}
                  rows={2}
                  maxLength={1000}
                  className="mt-1 block w-full rounded-control border border-hairline bg-card px-2 py-1.5 text-[12px] text-ink"
                />
              </label>
            </div>
            <DraftSaveButton
              label="Save delivery details"
              className="mt-2 w-fit"
            />
          </DraftForm>
        </DeliveryEditPanel>
      </DeliveryEditProvider>
    </Band>
  );
}

function GateChip({ gate }: { gate: Gate }) {
  return (
    <span className="flex items-center gap-1.5">
      <CheckDot state={gate.state} />
      <span className="text-[11.5px] font-medium text-ink">{gate.label}</span>
      {gate.detail ? (
        <span className="text-[11px] text-ink-faint">{gate.detail}</span>
      ) : null}
    </span>
  );
}

/** The review queue's statuses. Past them, the order has been sent on. */
const IN_REVIEW = ["received", "needs_review"];

function gateNote(detail: OrderDetail, blocker: Gate | null): string | null {
  if (detail.inviteQueued) {
    return "An earlier prototype queued an invite, but no email was sent. Dispatcher follow-up is required.";
  }

  if (detail.order.status === "awaiting_customer") {
    return "Waiting on the customer to approve in the portal. No email is sent yet.";
  }

  if (!IN_REVIEW.includes(detail.order.status)) return null;

  if (blocker) {
    return `Unlocks when ${blocker.label.toLowerCase()} is resolved.`;
  }

  return "Ready to send — the customer never sees a price we haven't checked.";
}

function GateBar({
  detail,
  orderId,
}: {
  detail: OrderDetail;
  orderId: string;
}) {
  const blocker = blockingGate(detail.gates);
  const { status } = detail.order;
  const note = gateNote(detail, blocker);

  return (
    <div className="sticky bottom-0 mt-3 border-t border-hairline bg-surface pt-3 pb-3">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {detail.gates.map((gate) => (
              <GateChip key={gate.key} gate={gate} />
            ))}
          </div>
          {note ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
              {note}
            </p>
          ) : null}
        </div>

        {detail.inviteQueued ? (
          // The order's status already says `awaiting_customer`, which implies a
          // message went out. It did not. This says so rather than letting the
          // state quietly overstate what happened.
          <span className="shrink-0 rounded-control bg-warning-bg px-3 py-1.5 text-[11.5px] font-medium text-warning-ink">
            Invite queued — not sent
          </span>
        ) : IN_REVIEW.includes(status) ? (
          <form action={sendForApproval} className="shrink-0">
            <input type="hidden" name="orderId" value={orderId} />
            <Button type="submit" size="sm" disabled={Boolean(blocker)}>
              Send for approval
            </Button>
          </form>
        ) : status === "awaiting_customer" ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-control bg-success-bg px-3 py-1.5 text-[11.5px] font-medium text-success-ink">
            <CheckIcon className="h-3.5 w-3.5" />
            Sent for approval
          </span>
        ) : (
          <Badge tone="neutral" bordered>
            {orderStatusLabel[status as OrderStatus] ?? status}
          </Badge>
        )}
      </div>
    </div>
  );
}

export default async function ReviewOrderPage(
  props: PageProps<"/dispatch/review/[orderId]">,
) {
  const { orderId } = await props.params;
  const { view: requested } = await props.searchParams;
  const { supabase } = await requireDispatcher();

  const detail = await loadOrderDetail(supabase, orderId);
  if (!detail) notFound();

  // A tab picked by hand wins; otherwise the list is the one the open order
  // belongs in.
  const view = isQueueView(requested)
    ? requested
    : viewForStatus(detail.order.status);

  const [queue, counts, exceptions] = await Promise.all([
    listQueue(supabase, view),
    countQueueViews(supabase),
    view === "review"
      ? listInboundExceptions(supabase)
      : Promise.resolve([] as InboundException[]),
  ]);

  return (
    <div className="flex min-h-full">
      <QueueRail
        view={view}
        counts={counts}
        queue={queue}
        exceptions={exceptions}
        selectedId={orderId}
      />
      <div className="flex min-w-0 flex-1 flex-col px-4 py-3.5">
        {detail.order.retailer === "lowes" ? <LowesPricingSteps /> : null}
        <div className="space-y-3">
          <ItemsBand detail={detail} orderId={orderId} />
          <DeliveryBand detail={detail} orderId={orderId} />
        </div>
        <GateBar detail={detail} orderId={orderId} />
      </div>
    </div>
  );
}
