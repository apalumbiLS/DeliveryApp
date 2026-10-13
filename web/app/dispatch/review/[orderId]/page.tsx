/**
 * The review queue, with one order open.
 *
 * This is the dispatcher's whole job: verify that we read the customer's cart
 * correctly, confirm where it is going, price it, and only then invite the
 * customer to pay. Every band below is one verification step, and the gate bar
 * at the bottom names whatever is still blocking.
 *
 * Built from the approved mockup direction — `app/mockups/dispatch/review-queue.tsx`
 * — and composed from the same `components/console/` primitives the mockup uses.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { Band } from "@/components/console/band";
import { CheckDot } from "@/components/console/check-row";
import { InboundExceptionList } from "@/components/console/inbound-exception-list";
import {
  SizePicker,
  type DeliverySize,
} from "@/components/console/size-picker";
import { Td, Th } from "@/components/console/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertIcon } from "@/components/ui/icons";
import {
  queueCheckoutInvite,
  updateOrderDelivery,
  updateOrderQuote,
  updateOrderStore,
} from "@/lib/dispatch/actions";
import { blockingGate, type Gate } from "@/lib/dispatch/gates";
import { CHECKOUT_INVITES_ENABLED } from "@/lib/dispatch/invite";
import {
  listInboundExceptions,
  listQueue,
  loadOrderDetail,
  type InboundException,
  type OrderDetail,
  type QueueEntry,
} from "@/lib/dispatch/review-queue";
import { requireDispatcher } from "@/lib/dispatch/require-dispatcher";
import { formatDistance } from "@/lib/geo";
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

const draftMessages: Record<string, { ok: boolean; text: string }> = {
  "store-saved": { ok: true, text: "Store saved." },
  "store-invalid": { ok: false, text: "Choose a Lowe's store before saving." },
  "store-error": {
    ok: false,
    text: "Store was not saved. Refresh and try again.",
  },
  "delivery-saved": { ok: true, text: "Delivery details saved." },
  "delivery-invalid": {
    ok: false,
    text: "Enter a complete address and on-site contact.",
  },
  "delivery-error": {
    ok: false,
    text: "Delivery details were not saved. Refresh and try again.",
  },
  "quote-saved": { ok: true, text: "Materials estimate and fees saved." },
  "quote-invalid": {
    ok: false,
    text: "Pick a size and enter valid dollar amounts.",
  },
  "quote-error": {
    ok: false,
    text: "Pricing was not saved. Refresh and try again.",
  },
};

function QueueRail({
  queue,
  exceptions,
  selectedId,
}: {
  queue: QueueEntry[];
  exceptions: InboundException[];
  selectedId: string;
}) {
  return (
    <div className="w-60 shrink-0 border-r border-hairline-soft">
      <div className="px-4 pt-3.5 pb-2 text-[10.5px] font-semibold tracking-widest text-ink-faint uppercase">
        Waiting on you · {queue.length}
      </div>
      <ul>
        {queue.map((entry) => (
          <li
            key={entry.id}
            className={cn(
              "border-t border-hairline-soft",
              entry.id === selectedId && "bg-accent-soft/50",
            )}
          >
            <Link
              href={`/dispatch/review/${entry.id}`}
              aria-current={entry.id === selectedId ? "true" : undefined}
              className="block px-4 py-2.5 transition-colors hover:bg-card-muted"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-medium tabular-nums">
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
                <Badge tone={entry.needsReview ? "danger" : "info"} bordered>
                  {entry.needsReview ? "Could not read" : "Ready to verify"}
                </Badge>
                <span className="truncate text-[11px] text-ink-faint">
                  {entry.itemCount} item{entry.itemCount === 1 ? "" : "s"}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <InboundExceptionList entries={exceptions} />
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
      <div className="grid grid-cols-[minmax(0,20rem)_minmax(0,1fr)] gap-3">
        <div>
          <div className="rounded-field border border-hairline bg-card-muted px-2.5 py-2">
            <div className="truncate text-[11.5px] font-medium">
              {detail.email?.senderEmail ?? "Unknown sender"}
            </div>
            <div className="mt-0.5 truncate text-[10.5px] text-ink-faint">
              {detail.email?.subject ?? "no subject"}
            </div>
          </div>

          {detail.email ? (
            // `sandbox=""` is the strongest of the four layers around this HTML:
            // no scripts, no forms, no navigation, opaque origin. The route it
            // points at adds a locked CSP and a sanitizer behind that.
            <iframe
              src={`/dispatch/email/${orderId}`}
              sandbox=""
              title="The cart email, as the retailer sent it"
              className="mt-2 h-96 w-full rounded-field border border-hairline bg-white"
            />
          ) : (
            <p className="mt-2 rounded-field bg-warning-bg px-2.5 py-2 text-[11.5px] leading-relaxed text-warning-ink">
              The original email is not attached to this order.
            </p>
          )}

          <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-faint">
            The email as the retailer sent it, with images limited to their own
            CDN and scripts blocked.
          </p>
        </div>

        <div>
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
                        {item.description}
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-ink-faint">
                        {item.storeSku ? `Item #${item.storeSku}` : null}
                        {item.storeSku && item.modelNumber ? " · " : null}
                        {item.modelNumber ? `Model #${item.modelNumber}` : null}
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
          ) : (
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-muted">
              Lowe&apos;s prints no prices, so there is nothing to reconcile
              against. The parser instead requires three independent counts of
              the items to agree — which they did for this cart.
            </p>
          )}
        </div>
      </div>
    </Band>
  );
}

function DeliveryBand({
  detail,
  orderId,
}: {
  detail: OrderDetail;
  orderId: string;
}) {
  const storeGate = detail.gates.find((gate) => gate.key === "store");

  return (
    <Band
      title="2 · Verify the delivery & price"
      status={
        <Badge tone={storeGate?.state === "warn" ? "warning" : "info"} bordered>
          {storeGate?.state === "warn"
            ? "Store looks far"
            : detail.delivery.label
              ? "Portal site"
              : "Confirm delivery"}
        </Badge>
      }
    >
      <div className="grid grid-cols-[minmax(0,13rem)_minmax(0,15rem)_minmax(0,1fr)] gap-3">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11.5px] font-medium text-ink-muted">
              Deliver to
            </span>
            <span className="text-[10.5px] text-ink-faint">
              {detail.delivery.label ? "portal site" : "confirm with customer"}
            </span>
          </div>
          <div className="mt-1.5 rounded-field border border-hairline bg-card-muted px-2.5 py-2">
            <div className="text-[12px] font-medium">
              {detail.delivery.label ?? "Job site"}
            </div>
            <div className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
              {detail.delivery.address ?? "No address captured"}
            </div>
            {detail.delivery.fields.contactName ? (
              <div className="mt-1 text-[11px] text-ink-muted">
                {detail.delivery.fields.contactName} ·{" "}
                {detail.delivery.fields.contactPhone}
              </div>
            ) : null}
            {detail.delivery.instructions ? (
              <div className="mt-1.5 border-t border-hairline-soft pt-1.5 text-[10.5px] leading-relaxed text-ink-faint">
                {detail.delivery.instructions}
              </div>
            ) : null}
          </div>
        </div>

        <form action={updateOrderStore}>
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
                {option.miles != null ? ` — ${option.miles.toFixed(1)} mi` : ""}
              </option>
            ))}
          </select>

          <Button type="submit" intent="secondary" size="sm" className="mt-2">
            Save store
          </Button>

          {storeGate?.state === "warn" ? (
            <div className="mt-1.5 flex items-start gap-1.5 rounded-control bg-warning-bg px-2 py-1.5">
              <AlertIcon className="mt-0.5 h-3 w-3 shrink-0 text-warning-ink" />
              <p className="text-[10.5px] leading-relaxed text-warning-ink">
                {storeGate.detail}
              </p>
            </div>
          ) : null}
        </form>

        <form action={updateOrderQuote}>
          <input type="hidden" name="orderId" value={orderId} />
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11.5px] font-medium text-ink-muted">
              Delivery size
            </span>
            <span className="text-[10.5px] text-ink-faint">sets the fee</span>
          </div>

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
                  Lowe&apos;s does not supply prices
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
              <span className="text-[11.5px] text-ink-muted">Mileage fee</span>
              <input
                name="mileage"
                inputMode="decimal"
                defaultValue={dollars(detail.order.mileageCents)}
                className="w-20 rounded-control border border-hairline bg-card px-2 py-1 text-right text-[12px] tabular-nums"
              />
            </div>

            <div className="mt-1 flex items-center justify-between border-t border-hairline-soft pt-1.5">
              <span className="text-[12px] font-semibold text-ink">Total</span>
              <span className="text-[14px] font-semibold text-ink tabular-nums">
                {money.format(detail.order.totalCents / 100)}
              </span>
            </div>

            <Button type="submit" intent="secondary" size="sm" className="mt-2">
              Save price
            </Button>

            <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-faint">
              Fees are entered by hand until the pricing model is settled.
            </p>
          </div>
        </form>
      </div>
      <form
        action={updateOrderDelivery}
        className="mt-3 border-t border-hairline-soft pt-3"
      >
        <input type="hidden" name="orderId" value={orderId} />
        <h3 className="text-[12px] font-medium text-ink">
          Confirm delivery with the customer
        </h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["line1", "Street address", detail.delivery.fields.line1],
              [
                "line2",
                "Suite / building (optional)",
                detail.delivery.fields.line2,
              ],
              ["city", "City", detail.delivery.fields.city],
              ["state", "State", detail.delivery.fields.state],
              ["postalCode", "ZIP code", detail.delivery.fields.postalCode],
              [
                "contactName",
                "On-site contact",
                detail.delivery.fields.contactName,
              ],
              [
                "contactPhone",
                "Contact phone",
                detail.delivery.fields.contactPhone,
              ],
            ] as const
          ).map(([name, label, value]) => (
            <label key={name} className="text-[11px] text-ink-muted">
              {label}
              <input
                name={name}
                defaultValue={value}
                required={name !== "line2"}
                type={name === "contactPhone" ? "tel" : "text"}
                className="mt-1 block w-full rounded-control border border-hairline bg-card px-2 py-1.5 text-[12px] text-ink"
              />
            </label>
          ))}
          <label className="text-[11px] text-ink-muted sm:col-span-2 lg:col-span-3">
            Delivery instructions (optional)
            <textarea
              name="instructions"
              defaultValue={detail.delivery.fields.instructions}
              rows={2}
              maxLength={1000}
              className="mt-1 block w-full rounded-control border border-hairline bg-card px-2 py-1.5 text-[12px] text-ink"
            />
          </label>
        </div>
        <Button type="submit" intent="secondary" size="sm" className="mt-2">
          Save delivery details
        </Button>
      </form>
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

function inviteNote(detail: OrderDetail, blocker: Gate | null): string {
  if (detail.inviteQueued) {
    return "An earlier prototype queued an invite, but no email was sent. Dispatcher follow-up is required.";
  }

  if (!CHECKOUT_INVITES_ENABLED) {
    return "Customer invitations are paused until checkout and outbound delivery are available. This order remains for dispatcher review.";
  }

  if (!detail.inviteRecipient) {
    return "No email address for this customer, so there is nobody to invite.";
  }

  if (blocker) {
    return `The invite unlocks when ${blocker.label.toLowerCase()} is resolved.`;
  }

  return "Ready to invite — the customer never sees a price we haven't checked.";
}

function GateBar({
  detail,
  orderId,
}: {
  detail: OrderDetail;
  orderId: string;
}) {
  const blocker = blockingGate(detail.gates);
  const canInvite =
    CHECKOUT_INVITES_ENABLED && !blocker && Boolean(detail.inviteRecipient);

  return (
    <div className="sticky bottom-0 mt-3 border-t border-hairline bg-surface pt-3 pb-3">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {detail.gates.map((gate) => (
              <GateChip key={gate.key} gate={gate} />
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
            {inviteNote(detail, blocker)}
          </p>
        </div>

        {detail.inviteQueued ? (
          // The order's status already says `awaiting_customer`, which implies a
          // message went out. It did not. This says so rather than letting the
          // state quietly overstate what happened.
          <span className="shrink-0 rounded-control bg-warning-bg px-3 py-1.5 text-[11.5px] font-medium text-warning-ink">
            Invite queued — not sent
          </span>
        ) : (
          <form action={queueCheckoutInvite} className="shrink-0">
            <input type="hidden" name="orderId" value={orderId} />
            <Button type="submit" size="sm" disabled={!canInvite}>
              Send checkout invite
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default async function ReviewOrderPage(
  props: PageProps<"/dispatch/review/[orderId]">,
) {
  const { orderId } = await props.params;
  const { draft } = await props.searchParams;
  const feedback = typeof draft === "string" ? draftMessages[draft] : null;
  const { supabase } = await requireDispatcher();

  const [queue, detail, exceptions] = await Promise.all([
    listQueue(supabase),
    loadOrderDetail(supabase, orderId),
    listInboundExceptions(supabase),
  ]);

  if (!detail) notFound();

  return (
    <div className="flex min-h-full">
      <QueueRail queue={queue} exceptions={exceptions} selectedId={orderId} />
      <div className="flex min-w-0 flex-1 flex-col px-4 py-3.5">
        {feedback ? (
          <p
            role={feedback.ok ? "status" : "alert"}
            className={cn(
              "mb-3 rounded-field px-3 py-2 text-[12px]",
              feedback.ok
                ? "bg-success-bg text-success-ink"
                : "bg-danger-bg text-danger-ink",
            )}
          >
            {feedback.text}
          </p>
        ) : null}
        <div className="space-y-3">
          <ItemsBand detail={detail} orderId={orderId} />
          <DeliveryBand detail={detail} orderId={orderId} />
        </div>
        <GateBar detail={detail} orderId={orderId} />
      </div>
    </div>
  );
}
