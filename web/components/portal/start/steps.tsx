"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Chevron, CopyIcon, ImageIcon } from "@/components/ui/icons";
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

/** The radio-card used by the site and store lists. */
function SelectCard({
  selected,
  title,
  subtitle,
  onClick,
  dashed,
}: {
  selected: boolean;
  title: string;
  subtitle?: string;
  onClick: () => void;
  dashed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-card border bg-card px-4 py-3.5 text-left transition-colors",
        selected ? "border-accent" : "border-hairline hover:bg-card-muted",
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
  value,
  onChange,
}: {
  retailers: RetailerId[];
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
          const selected = id === value;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-pressed={selected}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-card border bg-card px-4 py-3.5 text-left transition-colors",
                selected
                  ? "border-accent"
                  : "border-hairline hover:bg-card-muted",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-sunken text-[12px] font-semibold text-ink-muted">
                {retailer.label.slice(0, 1)}
              </span>
              <span className="flex-1 text-[13px] font-medium text-ink">
                {retailer.label}
              </span>
              <Chevron className="h-4 w-4 text-ink-faint" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

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

  const selected =
    ranked.find((entry) => entry.store.id === value)?.store ??
    ranked[0]?.store ??
    null;
  const selectedMiles =
    ranked.find((entry) => entry.store.id === selected?.id)?.miles ?? null;

  if (!selected) return null;

  return (
    <div>
      <StepHeading title="We'll pick up from here">
        {hasCoordinates
          ? `The closest store to ${siteLabel}.`
          : `We can't estimate distances for a new address yet — pick the store you'll use.`}
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
          {ranked.map((entry) => (
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
          ))}

          <p className="px-1 text-[11.5px] leading-relaxed text-ink-faint">
            Not seeing your store? Get in touch and we&apos;ll add it.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function CheckStoreStep({
  retailerId,
  store,
}: {
  retailerId: RetailerId;
  store: RankedStore;
}) {
  const retailer = RETAILERS[retailerId];

  return (
    <div>
      <StepHeading title="Check your store">
        At the end of these steps we&apos;ll open the {retailer.label} website
        for you. We&apos;re buying from {store.store.name}.
      </StepHeading>

      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
        If you see a{" "}
        <span className="font-medium text-ink">{retailer.storeAction}</span>{" "}
        button, click it.
      </p>

      <StoreDiagram retailerId={retailerId} store={store.store} />
    </div>
  );
}

export function BuildShareStep({
  retailerId,
  store,
  alias,
}: {
  retailerId: RetailerId;
  store: RankedStore;
  alias: string;
}) {
  const [copied, setCopied] = useState(false);
  const retailer = RETAILERS[retailerId];

  async function copy() {
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

      <div className="mt-3 flex items-center justify-between gap-2 rounded-field border border-hairline bg-card px-3 py-2.5">
        <span className="truncate font-mono text-[12px] text-ink">{alias}</span>
        <Button type="button" onClick={copy}>
          <CopyIcon className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

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
        We&apos;ll email you as soon as we read your cart. We&apos;re buying
        from {store.store.name}.
      </p>
    </div>
  );
}
