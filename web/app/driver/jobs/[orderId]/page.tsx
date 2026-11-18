/**
 * One job, at the link the dispatcher sends.
 *
 * Before accepting, the driver sees enough to decide — the store, the delivery
 * town, the size and the payout — and Accept. After accepting, the whole job:
 * what to buy, where it goes, who to call, and the next status step.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  DELIVERY_SIZE_LABELS,
  type DeliverySize,
} from "@/components/console/size-picker";
import { JobStep } from "@/components/driver/job-step";
import { NavigateLink } from "@/components/driver/navigate-link";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card } from "@/components/ui/card";
import { AlertIcon, CheckIcon, PhoneIcon } from "@/components/ui/icons";
import { SUPPORT_PHONE } from "@/lib/brand";
import { acceptJob } from "@/lib/driver/actions";
import {
  loadDriverJob,
  loadJobPosting,
  type DriverJob,
  type JobItem,
  type JobPosting,
} from "@/lib/driver/job";
import { requireDriverApp } from "@/lib/driver/require-driver";
import { hasReached, JOB_STEPS, nextStep } from "@/lib/driver/steps";
import { formatPhone } from "@/lib/phone";
import { orderStatusLabel, orderStatusTone } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Job",
};

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const time = new Intl.DateTimeFormat("en-US", { timeStyle: "short" });

function placeQuery(...parts: (string | null)[]): string {
  return parts.filter(Boolean).join(", ");
}

function sizeLabel(size: string | null): string | null {
  return size && size in DELIVERY_SIZE_LABELS
    ? DELIVERY_SIZE_LABELS[size as DeliverySize]
    : null;
}

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

/** A labeled part of a card, set off from the part above it. */
function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 border-t border-hairline-soft pt-3">
      <div className="text-[12.5px] text-ink-faint">{label}</div>
      <div className="mt-0.5 text-[15px] text-ink">{children}</div>
    </div>
  );
}

function CallDispatch() {
  return (
    <a
      href={SUPPORT_PHONE.href}
      className="mt-3 flex min-h-11 items-center justify-center gap-1.5 text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink"
    >
      <PhoneIcon className="h-4 w-4" />
      Call dispatch {SUPPORT_PHONE.display}
    </a>
  );
}

function BackToJobs() {
  return (
    <Link
      href="/driver"
      className="text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink"
    >
      ← Jobs
    </Link>
  );
}

function JobHeader({
  orderNumber,
  status,
  payoutCents,
}: {
  orderNumber: string;
  status: keyof typeof orderStatusLabel;
  payoutCents: number | null;
}) {
  return (
    <div>
      <BackToJobs />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-[21px] leading-tight font-semibold tracking-tight text-ink tabular-nums">
            Order {orderNumber}
          </h1>
          {payoutCents !== null ? (
            <p className="mt-1 text-[14px] text-ink-muted">
              Your payout{" "}
              <span className="font-semibold text-ink tabular-nums">
                {money.format(payoutCents / 100)}
              </span>
            </p>
          ) : null}
        </div>
        <Badge tone={orderStatusTone[status]} bordered>
          {orderStatusLabel[status]}
        </Badge>
      </div>
    </div>
  );
}

function Unavailable({ taken }: { taken: boolean }) {
  return (
    <div className="space-y-4">
      <BackToJobs />
      <Card className="p-5">
        <div className="flex items-start gap-2.5">
          <AlertIcon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-warning-ink" />
          <div className="min-w-0">
            <h1 className="text-[17px] font-semibold tracking-tight text-ink">
              {taken
                ? "Another driver took this job"
                : "This job isn't available"}
            </h1>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">
              {taken
                ? "Someone accepted it first. Don't go to the store for it."
                : "It may have been taken by another driver or withdrawn."}
            </p>
          </div>
        </div>
      </Card>
      <CallDispatch />
    </div>
  );
}

/**
 * A pick list: the quantity in its own box on the left, where it cannot be
 * read as part of a long product name, then the name and the numbers to
 * search for in the store.
 */
function ItemList({ items }: { items: JobItem[] }) {
  return (
    <ul className="divide-y divide-hairline-soft">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 py-3">
          <div className="flex h-12 min-w-12 shrink-0 flex-col items-center justify-center rounded-control border border-hairline bg-card-muted px-1.5">
            <span className="text-[17px] leading-none font-semibold text-ink tabular-nums">
              {item.quantity}
            </span>
            <span className="mt-1 text-[10px] leading-none font-semibold tracking-wider text-ink-faint uppercase">
              Qty
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] leading-snug text-ink">
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
            {item.storeSku || item.modelNumber ? (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-ink-muted tabular-nums">
                {item.storeSku ? <span>Item #{item.storeSku}</span> : null}
                {item.modelNumber ? (
                  <span>Model #{item.modelNumber}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function itemsTitle(prefix: string, items: JobItem[]): string {
  return `${prefix} · ${items.length} item${items.length === 1 ? "" : "s"}`;
}

function PostingView({
  posting,
  canAccept,
}: {
  posting: JobPosting;
  canAccept: boolean;
}) {
  const size = sizeLabel(posting.deliverySize);

  return (
    <div className="space-y-3">
      <BackToJobs />
      <Card className="p-5">
        <div className="text-[28px] leading-tight font-semibold tracking-tight text-ink tabular-nums">
          {posting.payoutCents !== null
            ? money.format(posting.payoutCents / 100)
            : "—"}
        </div>
        <div className="mt-0.5 text-[13.5px] text-ink-faint">Your payout</div>

        <dl className="mt-4 space-y-3 border-t border-hairline-soft pt-4">
          <div>
            <dt className="text-[12px] font-semibold tracking-widest text-ink-faint uppercase">
              Pick up at
            </dt>
            <dd className="mt-1 text-[15px] font-medium text-ink">
              {posting.retailerLabel}
              {posting.store.name ? ` · ${posting.store.name}` : null}
            </dd>
            {posting.store.address || posting.store.town ? (
              <dd className="mt-0.5 text-[13.5px] text-ink-muted">
                {[posting.store.address, posting.store.town]
                  .filter(Boolean)
                  .join(", ")}
              </dd>
            ) : null}
          </div>
          <div>
            <dt className="text-[12px] font-semibold tracking-widest text-ink-faint uppercase">
              Deliver to
            </dt>
            <dd className="mt-1 text-[15px] leading-relaxed text-ink">
              {posting.delivery.street || posting.delivery.town ? (
                <>
                  {posting.delivery.street ? (
                    <div>{posting.delivery.street}</div>
                  ) : null}
                  {posting.delivery.town ? (
                    <div>{posting.delivery.town}</div>
                  ) : null}
                </>
              ) : (
                "No address set"
              )}
            </dd>
            <dd className="mt-0.5 text-[13.5px] text-ink-muted">
              The on-site contact and drop-off notes show once you accept.
            </dd>
          </div>
          {size ? (
            <div>
              <dt className="text-[12px] font-semibold tracking-widest text-ink-faint uppercase">
                Vehicle needed
              </dt>
              <dd className="mt-1 text-[15px] font-medium text-ink">{size}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-4 border-t border-hairline-soft pt-4">
          <h2 className="text-[12px] font-semibold tracking-widest text-ink-faint uppercase">
            {itemsTitle("Items", posting.items)}
          </h2>
          <div className="mt-1">
            <ItemList items={posting.items} />
          </div>
        </div>

        {canAccept ? (
          <form action={acceptJob} className="mt-5">
            <input type="hidden" name="orderId" value={posting.id} />
            <SubmitButton
              size="md"
              className="w-full"
              pendingLabel="Accepting…"
            >
              Accept job
            </SubmitButton>
          </form>
        ) : (
          <p className="mt-5 rounded-control bg-card-muted px-3 py-2 text-[13.5px] leading-relaxed text-ink-muted">
            Drivers accept from this page. Dispatchers can only view it.
          </p>
        )}
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">
          First to accept gets the job. Check the store and items before you
          accept.
        </p>
      </Card>
      <CallDispatch />
    </div>
  );
}

function Progress({ job }: { job: DriverJob }) {
  const rows = [
    { status: "driver_assigned" as const, label: "Accepted" },
    ...JOB_STEPS.map((step) => ({
      status: step.to,
      label: orderStatusLabel[step.to],
    })),
  ];

  return (
    <SectionCard title="Progress">
      <ol>
        {rows.map((row) => {
          const done = hasReached(job.status, row.status);
          const at = job.reachedAt[row.status];
          return (
            <li key={row.status} className="flex items-center gap-2.5 py-1.5">
              {done ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-ink">
                  <CheckIcon className="h-3 w-3" />
                </span>
              ) : (
                <span className="h-5 w-5 shrink-0 rounded-full border border-hairline" />
              )}
              <span
                className={cn(
                  "flex-1 text-[14px]",
                  done ? "text-ink" : "text-ink-faint",
                )}
              >
                {row.label}
              </span>
              {done && at ? (
                <span className="text-[12.5px] text-ink-faint tabular-nums">
                  {time.format(new Date(at))}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}

function JobView({ job, canAct }: { job: DriverJob; canAct: boolean }) {
  const step = nextStep(job.status);
  const { delivery } = job;
  const size = sizeLabel(job.deliverySize);

  return (
    <div className="space-y-3">
      <JobHeader
        orderNumber={job.orderNumber}
        status={job.status}
        payoutCents={job.payoutCents}
      />

      <SectionCard title="Pick up at">
        <div className="text-[15px] font-medium text-ink">
          {job.retailerLabel}
          {job.store.name ? ` · ${job.store.name}` : null}
        </div>
        {job.store.address || job.store.town ? (
          <div className="mt-0.5 text-[13.5px] leading-relaxed text-ink-muted">
            {job.store.address ? <div>{job.store.address}</div> : null}
            {job.store.town ? <div>{job.store.town}</div> : null}
          </div>
        ) : null}
        <NavigateLink
          className="mt-3"
          query={placeQuery(
            `${job.retailerLabel} ${job.store.name ?? ""}`.trim(),
            job.store.address,
            job.store.town,
          )}
        />
      </SectionCard>

      <SectionCard title={itemsTitle("Buy exactly this", job.items)}>
        <ItemList items={job.items} />
        <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
          Out of stock? Call dispatch before you substitute anything.
        </p>
      </SectionCard>

      <SectionCard title="Deliver to">
        <div className="text-[15px] leading-relaxed text-ink">
          {delivery.street ? <div>{delivery.street}</div> : null}
          {delivery.town ? <div>{delivery.town}</div> : null}
        </div>
        <NavigateLink
          className="mt-3"
          query={placeQuery(delivery.street, delivery.town)}
        />

        {delivery.contactName || delivery.contactPhone ? (
          <DetailRow label="On-site contact">
            {delivery.contactName ? (
              <div className="font-medium">{delivery.contactName}</div>
            ) : null}
            {delivery.contactPhone ? (
              <a
                href={`tel:${delivery.contactPhone.replace(/[^\d+]/g, "")}`}
                className="inline-flex min-h-11 items-center gap-1.5 font-medium text-accent tabular-nums"
              >
                <PhoneIcon className="h-4 w-4" />
                {formatPhone(delivery.contactPhone)}
              </a>
            ) : null}
          </DetailRow>
        ) : null}

        {delivery.instructions ? (
          <DetailRow label="Drop-off notes">
            <p className="leading-relaxed">{delivery.instructions}</p>
          </DetailRow>
        ) : null}

        {size ? <DetailRow label="Vehicle needed">{size}</DetailRow> : null}
      </SectionCard>

      <Progress job={job} />

      {step && canAct ? (
        <div className="sticky bottom-0 -mx-5 border-t border-hairline bg-surface px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <JobStep orderId={job.id} step={step} />
          <CallDispatch />
        </div>
      ) : step ? null : (
        <Card className="flex items-start gap-2.5 bg-success-bg p-4">
          <CheckIcon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-success-ink" />
          <p className="text-[14px] leading-relaxed text-success-ink">
            Delivered. Nothing more to do on this job.
          </p>
        </Card>
      )}
    </div>
  );
}

export default async function DriverJobPage(
  props: PageProps<"/driver/jobs/[orderId]">,
) {
  const { orderId } = await props.params;
  const { taken } = await props.searchParams;
  if (!UUID.test(orderId)) notFound();

  const { supabase, role } = await requireDriverApp();
  const posting = await loadJobPosting(supabase, orderId);

  if (!posting) return <Unavailable taken={taken === "1"} />;

  if (posting.status === "driver_requested") {
    return <PostingView posting={posting} canAccept={role === "driver"} />;
  }

  const job = await loadDriverJob(supabase, orderId);
  if (!job) {
    return <Unavailable taken={false} />;
  }

  return <JobView job={job} canAct={role === "driver" && posting.isMine} />;
}
