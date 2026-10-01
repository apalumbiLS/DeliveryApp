import type { FlowStore } from "./types";

import { RETAILERS, type RetailerId } from "@/lib/retailers";

/**
 * A code-drawn impression of the top of the retailer's store page.
 *
 * Deliberately not a screenshot: a drawing cannot go stale when either
 * retailer redesigns, and there is nothing to re-capture.
 */
export function StoreDiagram({
  retailerId,
  store,
}: {
  retailerId: RetailerId;
  store: FlowStore;
}) {
  const retailer = RETAILERS[retailerId];
  const domain = new URL(retailer.homeUrl).hostname.replace(/^www\./, "");

  return (
    <figure className="mt-3">
      <div className="overflow-hidden rounded-field border border-hairline bg-card">
        <div className="flex items-center gap-1.5 border-b border-hairline-soft px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-sunken" />
          <span className="h-2 w-2 rounded-full bg-sunken" />
          <span className="h-2 w-2 rounded-full bg-sunken" />
          <span className="ml-2 truncate text-[10.5px] text-ink-faint">
            {domain}
          </span>
        </div>

        <div className="px-4 py-4">
          <div className="text-[18px] leading-tight font-bold tracking-tight text-ink">
            {store.storeLabel ?? store.name}
          </div>
          <div className="mt-2 text-[12px] leading-relaxed text-ink-muted">
            {store.addressLine1}
            <br />
            {[store.city, store.state].filter(Boolean).join(", ")}{" "}
            {store.postalCode}
          </div>

          <div className="mt-4 space-y-2.5" aria-hidden>
            <div className="h-3 w-28 rounded-full bg-sunken" />
            <div className="flex items-center gap-2.5">
              <div className="h-3 w-16 rounded-full bg-sunken" />
              <div className="h-3 w-20 rounded-full bg-sunken" />
              <div className="h-3 w-14 rounded-full bg-sunken" />
            </div>
          </div>

          <div className="mt-4">
            <span className="inline-flex rounded-control bg-accent px-4 py-2 text-[12.5px] font-semibold text-accent-ink">
              {retailer.storeAction}
            </span>
          </div>
        </div>
      </div>

      <figcaption className="mt-2 text-[11.5px] leading-relaxed text-ink-muted">
        What you&apos;ll see at the top of the {retailer.label} website.
      </figcaption>
    </figure>
  );
}
