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
    <figure className="mt-5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[10.5px] font-semibold tracking-[0.14em] text-ink-faint uppercase">
          Next step
        </span>
        <span className="text-[11.5px] leading-relaxed text-ink-muted">
          This is what you&apos;ll see when we open the {retailer.label}{" "}
          website.
        </span>
      </div>

      <div className="mt-2 overflow-hidden rounded-field border border-hairline bg-card">
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

          <div className="mt-5">
            <span className="inline-flex rounded-control bg-accent px-4 py-2 text-[12.5px] font-semibold text-accent-ink">
              {retailer.storeAction}
            </span>
          </div>
        </div>
      </div>

      <figcaption className="mt-2 text-[11.5px] leading-relaxed text-ink-muted">
        If you see{" "}
        <span className="font-medium text-ink">{retailer.storeAction}</span> at
        the top of the page, click it.
      </figcaption>
    </figure>
  );
}
