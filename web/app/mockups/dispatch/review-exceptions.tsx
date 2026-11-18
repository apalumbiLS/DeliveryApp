import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  CLEAN_QUOTES,
  EXCEPTION,
  FEE_POLICY,
  ORDERS,
  UNATTRIBUTED,
  type ReviewOrder,
} from "./data";
import {
  Band,
  CheckDot,
  ConsoleShell,
  PriceLine,
  SizePicker,
  type CheckState,
} from "./parts";

/* V3 — exception-first: the queue is sorted by risk, clean orders get one
   pass, and the exception gets a two-source verification with the decision
   it needs (keep this store, or switch to the nearest). */

function ExceptionRow({
  order,
  selected,
}: {
  order: ReviewOrder;
  selected: boolean;
}) {
  return (
    <li
      className={cn(
        "border-t border-hairline-soft px-3.5 py-2.5",
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
      <Badge tone={order.tone} bordered className="mt-1.5">
        {order.flag}
      </Badge>
    </li>
  );
}

function CleanRow({
  order,
  price,
}: {
  order: ReviewOrder;
  price: { size: string; total: string };
}) {
  return (
    <li className="border-t border-hairline-soft px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium">
          <CheckDot state="pass" />
          {order.number}
        </span>
        <span className="text-[11px] text-ink-faint tabular-nums">
          {order.age}
        </span>
      </div>
      <div className="mt-0.5 truncate text-[11.5px] text-ink-muted">
        {order.company} · {order.retailer}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="truncate text-[11.5px] text-ink">
          {order.store?.short} → {order.site.label}
        </span>
        <span className="shrink-0 text-[11px] text-ink-faint tabular-nums">
          {order.store?.distance} mi
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-faint tabular-nums">
          {price.size} · {price.total}
        </span>
        <Button intent="secondary" size="sm">
          Send
        </Button>
      </div>
    </li>
  );
}

function GroupHeader({ label }: { label: string }) {
  return (
    <div className="border-t border-hairline-soft px-3.5 pt-3 pb-2 text-[10.5px] font-semibold tracking-widest text-ink-faint uppercase">
      {label}
    </div>
  );
}

function QueueColumn() {
  const byNumber = (n: string) => ORDERS.find((o) => o.number === n);
  const exception = byNumber("#1052");
  const noItems = byNumber("#1049");
  const mismatch = byNumber("#1046");
  const clean = [byNumber("#1044"), byNumber("#1053")].filter(
    (o): o is ReviewOrder => Boolean(o),
  );

  return (
    <div className="w-64 shrink-0 border-r border-hairline-soft">
      <GroupHeader label="Exceptions · 3" />
      <ul>
        {[exception, mismatch, noItems].map((order) =>
          order ? (
            <ExceptionRow
              key={order.number}
              order={order}
              selected={order.number === EXCEPTION.number}
            />
          ) : null,
        )}
      </ul>
      <GroupHeader label="Looks clean · 2" />
      <ul>
        {clean.map((order) => (
          <CleanRow
            key={order.number}
            order={order}
            price={CLEAN_QUOTES[order.number] ?? { size: "Truck", total: "—" }}
          />
        ))}
      </ul>
      <GroupHeader label="Unattributed · 1" />
      <div className="border-t border-hairline-soft px-3.5 py-2.5">
        <div className="truncate text-[12px] font-medium">
          {UNATTRIBUTED.address}
        </div>
        <div className="mt-0.5 text-[11.5px] text-ink-muted">
          {UNATTRIBUTED.detail}
        </div>
      </div>
    </div>
  );
}

function SourceCard({
  title,
  source,
  state,
  headline,
  detail,
  children,
}: {
  title: string;
  source: string;
  state: CheckState;
  headline: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-field border border-hairline bg-card-muted px-2.5 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink">
          <CheckDot state={state} />
          {title}
        </span>
        <span className="text-[10.5px] text-ink-faint">{source}</span>
      </div>
      <div className="mt-1.5 text-[12px] font-medium text-ink">{headline}</div>
      <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
        {detail}
      </p>
      {children}
    </div>
  );
}

function TwoSourceBand() {
  const delta = (
    Number(EXCEPTION.store.distance) - Number(EXCEPTION.nearest.distance)
  ).toFixed(1);

  return (
    <Band
      title="1 · What agrees, what doesn't"
      status={
        <Badge tone="warning" bordered>
          One disagreement
        </Badge>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <SourceCard
          title="Store"
          source="customer picked"
          state="warn"
          headline={`${EXCEPTION.store.name} · ${EXCEPTION.store.distance} mi`}
          detail={`${EXCEPTION.nearest.short} is ${delta} mi closer to the site — 4× the distance, and the cart may not be stocked there.`}
        >
          <div className="mt-2 flex gap-1.5">
            <Button intent="secondary" size="sm">
              Keep {EXCEPTION.store.short}
            </Button>
            <Button intent="ghost" size="sm">
              Switch to {EXCEPTION.nearest.short}
            </Button>
          </div>
        </SourceCard>

        <SourceCard
          title="Delivery address"
          source="from the portal"
          state="pass"
          headline={`${EXCEPTION.site.label} · ${EXCEPTION.site.address}`}
          detail="Captured by the customer and unchanged since. No driver notes on this one."
        />

        <SourceCard
          title="Items"
          source="from the email"
          state="pass"
          headline={`${EXCEPTION.items} lines · ${EXCEPTION.materials}`}
          detail="Reconciles with the stated subtotal — nothing to correct by hand."
        />
      </div>
    </Band>
  );
}

function DistanceBand() {
  const chosen = Number(EXCEPTION.store.distance);
  const nearest = Number(EXCEPTION.nearest.distance);
  const typical = FEE_POLICY.mileage.freeMiles;
  const max = 10;
  const pct = (mi: number) => `${(mi / max) * 100}%`;

  return (
    <Band
      title="2 · Distance"
      status={
        <Badge tone="danger" bordered>
          {Math.round(chosen / nearest)}× the nearest store
        </Badge>
      }
    >
      <div className="relative mt-1 h-1.5 rounded-full bg-sunken">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-success/25"
          style={{ width: pct(typical) }}
        />
        <div
          className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-accent"
          style={{ left: pct(nearest) }}
        />
        <div
          className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-danger"
          style={{ left: pct(chosen) }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-ink-faint">
        <span>0 mi</span>
        <span>typical run ends at {typical} mi</span>
        <span>{max} mi</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11.5px]">
        <span className="flex items-center gap-1.5 text-ink-muted">
          <span className="h-2.5 w-0.5 rounded-full bg-accent" />
          Nearest · {nearest} mi ({EXCEPTION.nearest.short})
        </span>
        <span className="flex items-center gap-1.5 text-ink-muted">
          <span className="h-2.5 w-0.5 rounded-full bg-danger" />
          Chosen · {chosen} mi ({EXCEPTION.store.short})
        </span>
      </div>
    </Band>
  );
}

function QuoteBand() {
  return (
    <Band title="3 · Size & price">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11.5px] font-medium text-ink-muted">
              Delivery size
            </span>
            <span className="text-[10.5px] text-ink-faint">
              from the load, not the order
            </span>
          </div>
          <div className="mt-1.5">
            <SizePicker selected={EXCEPTION.size} hint={EXCEPTION.fit} />
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11.5px] font-medium text-ink-muted">
              Quote
            </span>
            <span className="text-[10.5px] text-ink-faint">
              {FEE_POLICY.mileage.rate}/mi after {FEE_POLICY.mileage.freeMiles}{" "}
              mi
            </span>
          </div>
          <div className="mt-1.5">
            <PriceLine
              label="Materials"
              value={EXCEPTION.materials}
              hint="cart"
            />
            <PriceLine
              label={`Sizing · ${EXCEPTION.size}`}
              value={EXCEPTION.sizing}
            />
            <PriceLine
              label="Mileage"
              value={EXCEPTION.mileage}
              hint={EXCEPTION.mileageNote}
            />
            <div className="mt-1 flex items-center justify-between border-t border-hairline-soft pt-1.5">
              <span className="text-[12px] font-semibold text-ink">Total</span>
              <span className="text-[14px] font-semibold text-ink tabular-nums">
                {EXCEPTION.total}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Band>
  );
}

function GateBar() {
  return (
    <div className="sticky bottom-0 mt-3 border-t border-hairline bg-surface pt-3 pb-1">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="flex items-center gap-1.5">
              <CheckDot state="pass" />
              <span className="text-[11.5px] font-medium text-ink">Items</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckDot state="pass" />
              <span className="text-[11.5px] font-medium text-ink">
                Address
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckDot state="warn" />
              <span className="text-[11.5px] font-medium text-ink">Store</span>
              <span className="text-[11px] text-ink-faint tabular-nums">
                7.2 mi — decide above
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckDot state="pass" />
              <span className="text-[11.5px] font-medium text-ink">
                Size &amp; price
              </span>
              <span className="text-[11px] text-ink-faint tabular-nums">
                {EXCEPTION.size} · {EXCEPTION.total}
              </span>
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
            One exception to settle. The two clean orders behind it go in a
            single pass each — and if the switch changes the store, the mileage
            is recomputed before anything sends.
          </p>
        </div>
        <Button size="sm" className="shrink-0">
          Send checkout invite
        </Button>
      </div>
    </div>
  );
}

export function ExceptionBoard() {
  return (
    <ConsoleShell
      title="Review queue"
      note="5 waiting · 3 exceptions · oldest 41m"
      active="Review queue"
    >
      <div className="flex min-h-full">
        <QueueColumn />
        <div className="flex min-w-0 flex-1 flex-col px-4 py-3.5">
          <div className="space-y-3">
            <TwoSourceBand />
            <DistanceBand />
            <QuoteBand />
          </div>
          <GateBar />
        </div>
      </div>
    </ConsoleShell>
  );
}
