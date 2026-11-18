import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

import {
  EMAIL,
  EXTRACTED,
  ORDERS,
  SITE,
  STORES,
  UNATTRIBUTED,
  type ReviewOrder,
} from "./data";
import {
  Band,
  CheckDot,
  ConsoleShell,
  Field,
  PriceLine,
  SizePicker,
  Td,
  Th,
  type CheckState,
} from "./parts";

/* V1 — the checklist: one order open, every verification step on one screen. */

function QueueRow({
  order,
  selected,
}: {
  order: ReviewOrder;
  selected: boolean;
}) {
  return (
    <li
      className={cn(
        "border-t border-hairline-soft px-4 py-2.5",
        selected && "bg-accent-soft/50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium">{order.number}</span>
        <span className="text-[11px] text-ink-faint tabular-nums">
          {order.age}
        </span>
      </div>
      <div className="mt-0.5 truncate text-[11.5px] text-ink-muted">
        {order.company} · {order.retailer}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="truncate text-[11.5px] text-ink">
          {order.store ? order.store.short : "No store"} → {order.site.label}
        </span>
        <span className="shrink-0 text-[11px] text-ink-faint tabular-nums">
          {order.store ? `${order.store.distance} mi` : "—"}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <Badge tone={order.tone} bordered>
          {order.flag}
        </Badge>
        <span className="truncate text-[11px] text-ink-faint">
          {order.items} items · {order.materials}
        </span>
      </div>
    </li>
  );
}

function QueueList({ selected }: { selected: string }) {
  return (
    <div className="w-60 shrink-0 border-r border-hairline-soft">
      <div className="px-4 pt-3.5 pb-2 text-[10.5px] font-semibold tracking-widest text-ink-faint uppercase">
        Waiting on you · {ORDERS.length}
      </div>
      <ul>
        {ORDERS.map((order) => (
          <QueueRow
            key={order.number}
            order={order}
            selected={order.number === selected}
          />
        ))}
      </ul>
      <div className="border-t border-hairline-soft px-4 pt-3 pb-2 text-[10.5px] font-semibold tracking-widest text-ink-faint uppercase">
        Unattributed · 1
      </div>
      <div className="border-t border-hairline-soft px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[12px] font-medium">
            {UNATTRIBUTED.address}
          </span>
          <span className="shrink-0 text-[11px] text-ink-faint tabular-nums">
            {UNATTRIBUTED.age}
          </span>
        </div>
        <div className="mt-0.5 text-[11.5px] text-ink-muted">
          {UNATTRIBUTED.detail}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          <Button intent="secondary" size="sm">
            Attach to company
          </Button>
          <Button intent="ghost" size="sm">
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

function ItemsBand() {
  return (
    <Band
      title="1 · Verify the items"
      status={
        <Badge tone="danger" bordered>
          Off by {EXTRACTED.delta}
        </Badge>
      }
    >
      <div className="grid grid-cols-[minmax(0,15rem)_minmax(0,1fr)] gap-3">
        <div>
          <div className="rounded-field border border-hairline bg-card-muted px-2.5 py-2">
            <div className="truncate text-[11.5px] font-medium">
              {EMAIL.from}
            </div>
            <div className="mt-0.5 text-[10.5px] text-ink-faint">
              {EMAIL.subject} · {EMAIL.received}
            </div>
          </div>
          <div className="mt-2 font-mono text-[10.5px]">
            {EMAIL.lines.map((line) => (
              <div
                key={line.name}
                className="flex items-baseline justify-between gap-2 py-0.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-ink">{line.name}</span>
                  <span className="block text-ink-faint">{line.detail}</span>
                </span>
                <span className="shrink-0 text-ink tabular-nums">
                  {line.amount}
                </span>
              </div>
            ))}
            <div className="mt-1.5 flex items-baseline justify-between border-t border-hairline-soft pt-1.5">
              <span className="tracking-widest text-ink-faint uppercase">
                Subtotal
              </span>
              <span className="font-semibold text-ink tabular-nums">
                {EMAIL.statedSubtotal}
              </span>
            </div>
          </div>
        </div>

        <div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-hairline-soft">
                <Th>Read from the email</Th>
                <Th className="w-12 text-right">Qty</Th>
                <Th className="w-20 text-right">Line total</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline-soft">
              {EXTRACTED.lines.map((line) => (
                <tr
                  key={line.model}
                  className={line.bad ? "bg-danger-bg/50" : undefined}
                >
                  <Td>
                    <Field
                      className={cn(
                        "truncate py-1",
                        line.bad && "border-danger/40",
                      )}
                    >
                      {line.name}{" "}
                      <span className="text-ink-faint">#{line.model}</span>
                    </Field>
                  </Td>
                  <Td>
                    <Field
                      className={cn(
                        "py-1 text-right tabular-nums",
                        line.bad && "border-danger/40 font-medium",
                      )}
                    >
                      {line.qty}
                    </Field>
                  </Td>
                  <Td>
                    <Field
                      className={cn(
                        "py-1 text-right tabular-nums",
                        line.bad && "border-danger/40 font-medium",
                      )}
                    >
                      {line.total}
                    </Field>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex items-start gap-2 rounded-control bg-danger-bg px-2.5 py-2">
            <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger-ink" />
            <p className="text-[11.5px] leading-relaxed text-danger-ink">
              Lines sum to {EXTRACTED.sum} — {EXTRACTED.delta} under the stated{" "}
              {EMAIL.statedSubtotal}. The OSB quantity is the mismatch.
            </p>
          </div>
        </div>
      </div>
    </Band>
  );
}

function AddressColumn() {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] font-medium text-ink-muted">
          Deliver to
        </span>
        <span className="text-[10.5px] text-ink-faint">from the portal</span>
      </div>
      <div className="mt-1.5 rounded-field border border-hairline bg-card-muted px-2.5 py-2">
        <div className="text-[12px] font-medium">{SITE.label}</div>
        <div className="mt-0.5 text-[11px] text-ink-muted">{SITE.address}</div>
        <div className="mt-1.5 border-t border-hairline-soft pt-1.5 text-[10.5px] leading-relaxed text-ink-faint">
          {SITE.notes}
        </div>
        <div className="mt-1 text-[10.5px] text-ink-faint">
          Contact · {SITE.contact} {SITE.phone}
        </div>
      </div>
      <button
        type="button"
        className="mt-1.5 cursor-pointer text-[11px] font-medium text-accent transition-colors hover:text-accent-hover"
      >
        Change address
      </button>
    </div>
  );
}

function StoreColumn() {
  const selected = STORES.homedepot[1];
  const alternatives = STORES.homedepot.filter((s) => s !== selected);
  const nearest = STORES.homedepot.reduce((a, b) =>
    Number(a.distance) <= Number(b.distance) ? a : b,
  );
  const delta = (Number(selected.distance) - Number(nearest.distance)).toFixed(
    1,
  );

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] font-medium text-ink-muted">Store</span>
        <span className="text-[10.5px] text-ink-faint">nearest first</span>
      </div>
      <div className="mt-1.5 rounded-field border border-hairline bg-card px-2.5 py-2">
        <div className="truncate text-[12px] font-medium">{selected.name}</div>
        <div className="mt-0.5 flex items-center justify-between gap-2 text-[10.5px] text-ink-faint">
          <span>chosen in the portal</span>
          <span className="tabular-nums">{selected.distance} mi</span>
        </div>
      </div>
      <div className="mt-1 space-y-1">
        {alternatives.map((store) => (
          <div
            key={store.name}
            className="flex items-center justify-between gap-2 rounded-control border border-hairline-soft px-2.5 py-1.5"
          >
            <span className="truncate text-[11px] text-ink-muted">
              {store.short}
            </span>
            <span className="shrink-0 text-[10.5px] text-ink-faint tabular-nums">
              {store.distance} mi
              {store === nearest ? " · nearest" : ""}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-start gap-1.5 rounded-control bg-warning-bg px-2 py-1.5">
        <AlertIcon className="mt-0.5 h-3 w-3 shrink-0 text-warning-ink" />
        <p className="text-[10.5px] leading-relaxed text-warning-ink">
          {nearest.short} is {delta} mi closer to the site.
        </p>
      </div>
    </div>
  );
}

function PriceColumn() {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] font-medium text-ink-muted">
          Delivery size
        </span>
        <span className="text-[10.5px] text-ink-faint">sets the fee</span>
      </div>
      <div className="mt-1.5">
        <SizePicker selected="Truck" />
      </div>
      <div className="mt-2.5 border-t border-hairline-soft pt-1.5">
        <PriceLine label="Materials" value={EMAIL.statedSubtotal} hint="cart" />
        <PriceLine label="Sizing fee" value="$25.00" input />
        <PriceLine label="Mileage fee" value="$5.25" input hint="5.1 mi" />
        <div className="mt-1 flex items-center justify-between border-t border-hairline-soft pt-1.5">
          <span className="text-[12px] font-semibold text-ink">Total</span>
          <span className="text-[14px] font-semibold text-ink tabular-nums">
            $189.99
          </span>
        </div>
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-faint">
          Fees are entered by hand until the pricing model is settled.
        </p>
      </div>
    </div>
  );
}

function GateChip({
  state,
  label,
  detail,
}: {
  state: CheckState;
  label: string;
  detail?: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <CheckDot state={state} />
      <span className="text-[11.5px] font-medium text-ink">{label}</span>
      {detail ? (
        <span className="text-[11px] text-ink-faint">{detail}</span>
      ) : null}
    </span>
  );
}

function GateBar() {
  return (
    <div className="sticky bottom-0 mt-3 border-t border-hairline bg-surface pt-3 pb-1">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <GateChip state="fail" label="Items" detail="off by $23.98" />
            <GateChip state="warn" label="Store" detail="2.7 mi further" />
            <GateChip state="pass" label="Address" />
            <GateChip state="pass" label="Size & price" />
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
            The invite unlocks when the items reconcile — the customer never
            sees a price we haven&apos;t checked.
          </p>
        </div>
        <Button size="sm" disabled className="shrink-0">
          Send checkout invite
        </Button>
      </div>
    </div>
  );
}

export function ReviewQueue() {
  return (
    <ConsoleShell
      title="Review queue"
      note="5 waiting · every order is verified here before the invite goes out"
      active="Review queue"
    >
      <div className="flex min-h-full">
        <QueueList selected="#1046" />
        <div className="flex min-w-0 flex-1 flex-col px-4 py-3.5">
          <div className="space-y-3">
            <ItemsBand />
            <Band
              title="2 · Verify the delivery & price"
              status={
                <Badge tone="warning" bordered>
                  Store 2.7 mi out
                </Badge>
              }
            >
              <div className="grid grid-cols-[minmax(0,13rem)_minmax(0,12rem)_minmax(0,1fr)] gap-3">
                <AddressColumn />
                <StoreColumn />
                <PriceColumn />
              </div>
            </Band>
          </div>
          <GateBar />
        </div>
      </div>
    </ConsoleShell>
  );
}
