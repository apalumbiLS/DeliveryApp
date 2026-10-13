"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { CopyIcon, ImageIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { formatDistance } from "@/lib/geo";
import { RETAILERS, type RetailerId } from "@/lib/retailers";
import { cn } from "@/lib/utils";

import { StoreDiagram } from "./store-diagram";
import {
  formatAddress,
  type FlowSite,
  type NewAddressDraft,
  type RankedStore,
} from "./types";

/** The radio-card used by the site, store, and retailer lists. */
function SelectCard({
  selected,
  title,
  subtitle,
  onClick,
  dashed,
  leading,
  disabled,
}: {
  selected: boolean;
  title: string;
  subtitle?: string;
  onClick: () => void;
  dashed?: boolean;
  leading?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-card border bg-card px-4 py-3.5 text-left transition-colors",
        disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
        selected ? "border-accent" : "border-hairline",
        !disabled && !selected && "hover:bg-card-muted",
        dashed && !selected && "border-dashed",
      )}
    >
      <span
        className={cn(
          "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-accent" : "border-hairline",
        )}
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
      </span>
      {leading}
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-ink">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block text-[11.5px] text-ink-faint">
            {subtitle}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function RetailerMark({ label }: { label: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-sunken text-[12px] font-semibold text-ink-muted">
      {label.slice(0, 1)}
    </span>
  );
}

function StepHeading({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <h2 className="text-[19px] leading-snug font-semibold tracking-tight text-ink">
        {title}
      </h2>
      {children ? (
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
          {children}
        </p>
      ) : null}
    </>
  );
}

export function SiteStep({
  sites,
  mode,
  savedSiteId,
  address,
  onSelectSaved,
  onSelectNew,
  onAddressChange,
}: {
  sites: FlowSite[];
  mode: "saved" | "new";
  savedSiteId: string | null;
  address: NewAddressDraft;
  onSelectSaved: (siteId: string) => void;
  onSelectNew: () => void;
  onAddressChange: (patch: Partial<NewAddressDraft>) => void;
}) {
  return (
    <div>
      <StepHeading title="Where's it going?">
        Pick the job site — that&apos;s where we&apos;ll deliver.
      </StepHeading>

      <div className="mt-4 space-y-2.5">
        {sites.map((site) => (
          <SelectCard
            key={site.id}
            selected={mode === "saved" && savedSiteId === site.id}
            title={site.label ?? formatAddress(site)}
            subtitle={formatAddress(site)}
            onClick={() => onSelectSaved(site.id)}
          />
        ))}

        <SelectCard
          dashed
          selected={mode === "new"}
          title="Enter a new address"
          subtitle="We'll save it for next time."
          onClick={onSelectNew}
        />
      </div>

      {mode === "new" ? (
        <div className="mt-4 space-y-4">
          <Field id="site-label" label="Name this site" hint="Optional.">
            {(control) => (
              <Input
                {...control}
                value={address.label}
                placeholder="Oakwood Phase 3"
                onChange={(event) =>
                  onAddressChange({ label: event.target.value })
                }
              />
            )}
          </Field>

          <Field id="site-line1" label="Street address">
            {(control) => (
              <Input
                {...control}
                value={address.line1}
                autoComplete="address-line1"
                onChange={(event) =>
                  onAddressChange({ line1: event.target.value })
                }
              />
            )}
          </Field>

          <Field id="site-line2" label="Suite, building, unit" hint="Optional.">
            {(control) => (
              <Input
                {...control}
                value={address.line2}
                autoComplete="address-line2"
                onChange={(event) =>
                  onAddressChange({ line2: event.target.value })
                }
              />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field id="site-city" label="City">
              {(control) => (
                <Input
                  {...control}
                  value={address.city}
                  autoComplete="address-level2"
                  onChange={(event) =>
                    onAddressChange({ city: event.target.value })
                  }
                />
              )}
            </Field>

            <Field id="site-state" label="State">
              {(control) => (
                <Input
                  {...control}
                  value={address.state}
                  autoComplete="address-level1"
                  maxLength={2}
                  onChange={(event) =>
                    onAddressChange({ state: event.target.value })
                  }
                />
              )}
            </Field>
          </div>

          <Field id="site-postal" label="ZIP code">
            {(control) => (
              <Input
                {...control}
                value={address.postalCode}
                autoComplete="postal-code"
                inputMode="numeric"
                onChange={(event) =>
                  onAddressChange({ postalCode: event.target.value })
                }
              />
            )}
          </Field>
        </div>
      ) : null}
    </div>
  );
}

export function RetailerStep({
  retailers,
  unavailable = [],
  value,
  onChange,
}: {
  retailers: RetailerId[];
  unavailable?: RetailerId[];
  value: RetailerId | null;
  onChange: (id: RetailerId) => void;
}) {
  return (
    <div>
      <StepHeading title="Where do you want to shop?">
        You&apos;ll build the cart on their website. We&apos;ll show you how.
      </StepHeading>

      <div className="mt-4 space-y-2.5">
        {retailers.map((id) => {
          const retailer = RETAILERS[id];

          return (
            <SelectCard
              key={id}
              selected={id === value}
              title={retailer.label}
              onClick={() => onChange(id)}
              leading={<RetailerMark label={retailer.label} />}
            />
          );
        })}

        {unavailable.map((id) => {
          const retailer = RETAILERS[id];

          return (
            <SelectCard
              key={id}
              disabled
              selected={false}
              title={retailer.label}
              subtitle="Coming soon"
              onClick={() => onChange(id)}
              leading={<RetailerMark label={retailer.label} />}
            />
          );
        })}
      </div>
    </div>
  );
}

/** How many stores the list shows before the customer searches. */
const NEAREST_SHOWN = 5;

export function StoreStep({
  ranked,
  value,
  siteLabel,
  hasCoordinates,
  onChange,
}: {
  ranked: RankedStore[];
  value: string | null;
  siteLabel: string;
  hasCoordinates: boolean;
  onChange: (storeId: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [filter, setFilter] = useState("");

  const selected =
    ranked.find((entry) => entry.store.id === value)?.store ??
    ranked[0]?.store ??
    null;
  const selectedMiles =
    ranked.find((entry) => entry.store.id === selected?.id)?.miles ?? null;

  const query = filter.trim().toLowerCase();

  // One search over the things a customer actually knows: the ZIP, the city, or
  // any part of the store's name.
  const filtered = query
    ? ranked.filter(({ store }) =>
        [store.name, store.storeLabel, store.city, store.postalCode].some(
          (field) => field !== null && field.toLowerCase().includes(query),
        ),
      )
    : ranked;

  // Unsearched, the list stays short — but it never hides the current choice.
  const visible = query
    ? filtered
    : filtered.filter(
        (entry, index) =>
          index < NEAREST_SHOWN || entry.store.id === selected?.id,
      );

  if (!selected) return null;

  return (
    <div>
      <StepHeading title="We'll pick up from here">
        {hasCoordinates
          ? `The closest store to ${siteLabel}.`
          : `We couldn't match that ZIP to a location, so these are in name order.`}
      </StepHeading>

      <Card className="mt-4 px-4 py-4">
        <div className="text-[15px] font-semibold tracking-tight text-ink">
          {selected.name}
        </div>
        <div className="mt-1 text-[12px] text-ink-muted">
          {selectedMiles !== null
            ? `${formatDistance(selectedMiles)} from ${siteLabel} · `
            : ""}
          {formatAddress(selected)}
        </div>
      </Card>

      <button
        type="button"
        onClick={() => setPicking((open) => !open)}
        className="mt-2.5 cursor-pointer text-[12.5px] font-medium text-accent"
      >
        {picking ? "Hide other stores" : "Choose another store"}
      </button>

      {picking ? (
        <div className="mt-2.5 space-y-2">
          <Input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search by ZIP, city, or store name"
            aria-label="Search stores"
          />

          {visible.length === 0 ? (
            <p className="px-1 py-1 text-[11.5px] leading-relaxed text-ink-faint">
              No stores match “{filter.trim()}”. Get in touch and we&apos;ll add
              it.
            </p>
          ) : (
            visible.map((entry) => (
              <SelectCard
                key={entry.store.id}
                selected={entry.store.id === selected.id}
                title={entry.store.name}
                subtitle={[
                  entry.miles !== null ? formatDistance(entry.miles) : null,
                  formatAddress(entry.store),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                onClick={() => onChange(entry.store.id)}
              />
            ))
          )}

          {visible.length > 0 ? (
            <p className="px-1 text-[11.5px] leading-relaxed text-ink-faint">
              {query
                ? `${filtered.length} of ${ranked.length} match “${filter.trim()}”. `
                : hasCoordinates
                  ? `Showing the ${visible.length} closest of ${ranked.length}. `
                  : `Showing ${visible.length} of ${ranked.length}. `}
              Not seeing your store? Get in touch and we&apos;ll add it.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function CheckStoreStep({
  retailerId,
  store,
  onChangeStore,
}: {
  retailerId: RetailerId;
  store: RankedStore;
  onChangeStore: () => void;
}) {
  const retailer = RETAILERS[retailerId];

  return (
    <div>
      <StepHeading title="Check your store">
        We&apos;re buying from {store.store.name}. But {retailer.label} has its
        own store setting, and that&apos;s what decides the prices, stock, and
        aisles you&apos;ll see while you build your cart.
      </StepHeading>

      <button
        type="button"
        onClick={onChangeStore}
        className="mt-2 cursor-pointer text-[12.5px] font-medium text-accent transition-colors hover:text-accent-hover"
      >
        Change store
      </button>

      <StoreDiagram retailerId={retailerId} store={store.store} />
    </div>
  );
}

export function BuildShareStep({
  retailerId,
  store,
  alias,
  aliasDiagnostic,
}: {
  retailerId: RetailerId;
  store: RankedStore;
  alias: string | null;
  aliasDiagnostic?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const retailer = RETAILERS[retailerId];

  async function copy() {
    if (!alias) return;

    try {
      await navigator.clipboard.writeText(alias);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the address is on screen to copy by
      // hand, so this is not worth an error state.
    }
  }

  return (
    <div>
      <StepHeading title="Build & share your cart">
        Add everything you need — but don&apos;t check out. The cart is your
        request to us. Then tap Share Cart and paste this address:
      </StepHeading>

      {alias ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-field border border-hairline bg-card px-3 py-2.5">
          <span className="truncate font-mono text-[12px] text-ink">
            {alias}
          </span>
          <Button type="button" onClick={copy}>
            <CopyIcon className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-3 rounded-field bg-warning-bg px-3 py-2 text-[12.5px] leading-relaxed text-warning-ink">
            We don&apos;t have an order address set up yet. Get in touch and
            we&apos;ll sort it out before you build your cart.
          </p>
          {aliasDiagnostic ? (
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-ink-faint">
              dev: {aliasDiagnostic}
            </p>
          ) : null}
        </>
      )}

      <figure className="mt-3">
        <div className="flex h-40 items-center justify-center gap-2 rounded-field border border-dashed border-hairline bg-sunken/60 text-ink-faint">
          <ImageIcon className="h-4 w-4" />
          <span className="text-[11px] font-medium tracking-widest uppercase">
            Screenshot
          </span>
        </div>
        <figcaption className="mt-2 text-[11.5px] leading-relaxed text-ink-muted">
          The Share Cart button, inside your cart on the {retailer.label}{" "}
          website. We&apos;ll drop a picture in once we have one from the
          retailer.
        </figcaption>
      </figure>

      <p className="mt-4 text-[11.5px] leading-relaxed text-ink-faint">
        Our dispatcher will review your cart and confirm the missing details
        before anyone buys from {store.store.name}.
      </p>
    </div>
  );
}
