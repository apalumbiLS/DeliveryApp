"use client";

import { Check, CirclePlay } from "lucide-react";
import { useState } from "react";

import { button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { CopyIcon, ExternalLinkIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { formatDistance } from "@/lib/geo";
import { RETAILERS, type RetailerId } from "@/lib/retailers";
import { cn } from "@/lib/utils";

import { FinishTutorial } from "./finish-tutorial";
import {
  formatAddress,
  type FlowSite,
  type NewAddressDraft,
  type RankedStore,
} from "./types";

/** Sites shown before "Show all"; the likeliest one is already first. */
const SITES_SHOWN = 3;

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
  const [showAll, setShowAll] = useState(false);
  const selectedIndex = sites.findIndex((site) => site.id === savedSiteId);
  // Coming back to this step with a site from further down keeps it visible.
  const expanded =
    showAll ||
    sites.length <= SITES_SHOWN ||
    (mode === "saved" && selectedIndex >= SITES_SHOWN);
  const visibleSites = expanded ? sites : sites.slice(0, SITES_SHOWN);

  return (
    <div>
      <StepHeading title="Where's it going?">
        Pick the job site — that&apos;s where we&apos;ll deliver.
      </StepHeading>

      <div className="mt-4 space-y-2.5">
        {visibleSites.map((site) => (
          <SelectCard
            key={site.id}
            selected={mode === "saved" && savedSiteId === site.id}
            title={site.label ?? formatAddress(site)}
            subtitle={formatAddress(site)}
            onClick={() => onSelectSaved(site.id)}
          />
        ))}

        {expanded ? null : (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="w-full py-1.5 text-[12.5px] font-medium text-accent transition-colors hover:text-accent-hover"
          >
            Show all {sites.length} sites
          </button>
        )}

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
        className="mt-2.5 cursor-pointer text-[12.5px] font-medium text-accent transition-colors hover:text-accent-hover"
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
              Not seeing your store? Get in touch and we&apos;ll add it.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Per device, not per account: a pilot shortcut that needs no migration. Someone
 * switching from phone to computer sees the explainer once more.
 */
const EXPLAINER_HIDDEN_KEY = "materials-delivered:finish-explainer-hidden";

function readExplainerHidden() {
  try {
    return window.localStorage.getItem(EXPLAINER_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeExplainerHidden(hidden: boolean) {
  try {
    if (hidden) window.localStorage.setItem(EXPLAINER_HIDDEN_KEY, "1");
    else window.localStorage.removeItem(EXPLAINER_HIDDEN_KEY);
  } catch {
    // Storage can be blocked; they'll just see the explainer next time.
  }
}

/**
 * The last step. The tutorial opens over it the first time, to show what to do
 * on the retailer's site; repeat customers can turn that off. Underneath are
 * the actions: copy the address, and only then open the store — so the
 * address is on the clipboard before they leave, and nobody jumps to the
 * retailer unbriefed.
 */
export function FinishStep({
  retailerId,
  store,
  alias,
}: {
  retailerId: RetailerId;
  store: RankedStore;
  alias: string | null;
}) {
  // Only rendered after the customer reaches the last step, never on the
  // server, so reading storage in the initializer can't mismatch hydration.
  const [tutorialOpen, setTutorialOpen] = useState(
    () => !readExplainerHidden(),
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const retailer = RETAILERS[retailerId];

  async function copy() {
    if (!alias) return;

    try {
      await navigator.clipboard.writeText(alias);
      setCopyState("copied");
    } catch {
      // Clipboard access can be denied. The address is on screen to copy by
      // hand, and the store button still appears so nobody is stuck.
      setCopyState("failed");
    }
  }

  return (
    <div>
      {tutorialOpen ? (
        <FinishTutorial
          retailerId={retailerId}
          initialHide={readExplainerHidden()}
          onClose={() => setTutorialOpen(false)}
          onGotIt={(hide) => {
            writeExplainerHidden(hide);
            setTutorialOpen(false);
          }}
        />
      ) : null}

      <StepHeading title={`Finish on ${retailer.label}`} />

      {alias ? (
        <div className="mt-5">
          <p className="text-[12.5px] text-ink-muted">
            You&apos;ll paste this as the recipient
          </p>
          <p className="mt-2 rounded-field border border-hairline bg-card px-3 py-2.5 font-mono text-[13px] break-all text-ink select-all">
            {alias}
          </p>

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={copy}
              className={cn(
                button({
                  intent: copyState === "idle" ? "primary" : "secondary",
                  size: "lg",
                }),
                "w-full sm:w-auto",
              )}
            >
              {copyState === "copied" ? (
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  Copied
                </>
              ) : (
                <>
                  <CopyIcon className="h-4 w-4" />
                  Copy address
                </>
              )}
            </button>

            {copyState === "idle" ? null : (
              <a
                href={store.store.storeUrl ?? retailer.homeUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  button({ intent: "primary", size: "lg" }),
                  "w-full justify-between sm:w-auto",
                )}
              >
                Open {store.store.name}
                <ExternalLinkIcon className="h-4 w-4" />
              </a>
            )}
          </div>

          {copyState === "failed" ? (
            <p className="mt-2 text-[12.5px] text-warning-ink">
              Couldn&apos;t copy. Copy the address by hand.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 rounded-field bg-warning-bg px-3 py-2 text-[12.5px] leading-relaxed text-warning-ink">
          We don&apos;t have an order address set up yet. Get in touch and
          we&apos;ll sort it out before you build your cart.
        </p>
      )}

      {/* Well away from the buttons, and quiet: a way back to the tutorial,
          not a next step. */}
      <div className="mt-12 flex justify-end">
        <button
          type="button"
          onClick={() => setTutorialOpen(true)}
          className="flex items-center gap-1.5 text-[12px] text-ink-faint transition-colors hover:text-ink-muted"
        >
          <CirclePlay className="h-3.5 w-3.5" aria-hidden />
          How it works
        </button>
      </div>
    </div>
  );
}
