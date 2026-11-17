import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  DELIVERY_SIZE_LABELS,
  type DeliverySize,
} from "@/components/console/size-picker";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Chevron, PinIcon } from "@/components/ui/icons";
import { List } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-header";
import {
  listMyJobs,
  listOpenJobs,
  type JobPosting,
  type JobSummary,
} from "@/lib/driver/job";
import { requireDriverApp } from "@/lib/driver/require-driver";
import { orderStatusLabel, orderStatusTone } from "@/lib/tokens";

export const metadata: Metadata = {
  title: "Jobs",
};

export const dynamic = "force-dynamic";

const shortDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function postedAgo(iso: string): string {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (minutes < 1) return "Posted just now";
  if (minutes < 60) return `Posted ${minutes} min ago`;
  if (minutes < 60 * 24) return `Posted ${Math.round(minutes / 60)} h ago`;
  return `Posted ${shortDate.format(new Date(iso))}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[12px] font-semibold tracking-widest text-ink-faint uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function JobRow({ job }: { job: JobSummary }) {
  return (
    <li>
      <Link
        href={`/driver/jobs/${job.id}`}
        className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-card-muted"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[15px] font-medium text-ink tabular-nums">
              {job.orderNumber}
            </span>
            <Badge tone={orderStatusTone[job.status]} bordered>
              {orderStatusLabel[job.status]}
            </Badge>
          </div>
          <div className="mt-1 truncate text-[13.5px] text-ink-muted">
            {[job.storeName, job.deliveryTown].filter(Boolean).join(" → ")}
          </div>
        </div>
        {job.status === "delivered" ? (
          <span className="shrink-0 text-[12.5px] text-ink-faint">
            {shortDate.format(new Date(job.updatedAt))}
          </span>
        ) : null}
        <Chevron className="h-4 w-4 shrink-0 text-ink-faint" />
      </Link>
    </li>
  );
}

/** Enough to decide whether to open it: payout, store, destination, size. */
function OpenJobCard({ posting }: { posting: JobPosting }) {
  const size =
    posting.deliverySize && posting.deliverySize in DELIVERY_SIZE_LABELS
      ? DELIVERY_SIZE_LABELS[posting.deliverySize as DeliverySize]
      : null;

  return (
    <Link
      href={`/driver/jobs/${posting.id}`}
      className="block rounded-card transition-shadow hover:shadow-md"
    >
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[21px] leading-tight font-semibold tracking-tight text-ink tabular-nums">
              {posting.payoutCents !== null
                ? money.format(posting.payoutCents / 100)
                : "—"}
            </div>
            <div className="mt-0.5 text-[13px] text-ink-faint">Your payout</div>
          </div>
          <span className="shrink-0 text-[12.5px] text-ink-faint">
            {postedAgo(posting.postedAt)}
          </span>
        </div>

        <div className="mt-3 space-y-1.5 border-t border-hairline-soft pt-3 text-[14px]">
          <div className="flex items-start gap-2">
            <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
            <div className="min-w-0">
              <div className="font-medium text-ink">
                {posting.retailerLabel}
                {posting.store.name ? ` · ${posting.store.name}` : null}
              </div>
              <div className="text-ink-muted">
                to{" "}
                {[posting.delivery.street, posting.delivery.town]
                  .filter(Boolean)
                  .join(", ") || "no address set"}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral" bordered>
            {posting.items.length} item{posting.items.length === 1 ? "" : "s"}
          </Badge>
          {size ? (
            <Badge tone="accent" bordered>
              {size}
            </Badge>
          ) : null}
          <span className="ml-auto flex items-center gap-1 text-[13.5px] font-medium text-accent">
            View job
            <Chevron className="h-4 w-4" />
          </span>
        </div>
      </Card>
    </Link>
  );
}

export default async function DriverHomePage() {
  const { supabase, userId } = await requireDriverApp();
  const [jobs, open] = await Promise.all([
    listMyJobs(supabase, userId),
    listOpenJobs(supabase),
  ]);
  const active = jobs.filter((job) => job.status !== "delivered");
  const delivered = jobs.filter((job) => job.status === "delivered");

  return (
    <div className="space-y-6">
      <PageHeader title="Jobs" />

      {active.length > 0 ? (
        <Section title="In progress">
          <List>
            {active.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </List>
        </Section>
      ) : null}

      <Section title="Open jobs">
        {open.length > 0 ? (
          <div className="space-y-3">
            {open.map((posting) => (
              <OpenJobCard key={posting.id} posting={posting} />
            ))}
          </div>
        ) : (
          <Card className="p-5">
            <p className="text-[14px] leading-relaxed text-ink-muted">
              No open jobs right now. New jobs show up here.
            </p>
          </Card>
        )}
      </Section>

      {delivered.length > 0 ? (
        <Section title="Delivered">
          <List>
            {delivered.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </List>
        </Section>
      ) : null}
    </div>
  );
}
