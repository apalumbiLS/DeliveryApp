"use client";

import { useEffect, useRef, useState } from "react";

import { Button, button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Chevron,
  CopyIcon,
  ExternalLinkIcon,
  ImageIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

import { ALIAS } from "../orders/shared";
import {
  RETAILERS,
  SITES,
  SUPPORT_PHONE,
  storeLink,
  type Retailer,
  type RetailerId,
  type Site,
  type Store,
} from "./data";

const STEP_COUNT = 5;

/** The gap-closing flow: site → retailer → store → set your store → build & share. */
export function StartOrderFlow() {
  const [step, setStep] = useState(0);
  const [siteIndex, setSiteIndex] = useState(0);
  const [retailerId, setRetailerId] = useState<RetailerId>("lowes");
  const [storeIndex, setStoreIndex] = useState(0);
  const [pickingStore, setPickingStore] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const site = SITES[siteIndex];
  const retailer = RETAILERS.find((r) => r.id === retailerId) ?? RETAILERS[0];
  const store = retailer.stores[storeIndex] ?? retailer.stores[0];
  const last = step === STEP_COUNT - 1;

  useEffect(() => {
    rootRef.current?.closest("[data-frame-scroll]")?.scrollTo({ top: 0 });
  }, [step]);

  const selectRetailer = (id: RetailerId) => {
    setRetailerId(id);
    setStoreIndex(0);
    setPickingStore(false);
  };

  return (
    <div
      ref={rootRef}
      className="flex min-h-full flex-col bg-surface font-sans text-ink"
    >
      <header className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="flex cursor-pointer items-center gap-1 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              <Chevron className="h-3.5 w-3.5 rotate-180" />
              Back
            </button>
          ) : (
            <span className="text-[12px] font-medium text-ink-muted">
              ← Home
            </span>
          )}
          <span className="text-[12px] font-medium text-ink-muted">
            Start an order
          </span>
        </div>

        <div className="mt-4 flex items-center gap-1.5">
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <span
              key={i}
              className={
                i <= step
                  ? "h-1 flex-1 rounded-full bg-accent"
                  : "h-1 flex-1 rounded-full bg-sunken"
              }
            />
          ))}
        </div>
        <div className="mt-2 text-[10.5px] font-semibold tracking-[0.14em] text-ink-faint uppercase">
          Step {step + 1} of {STEP_COUNT}
        </div>
      </header>

      <section className="px-5 pb-6">
        {step === 0 ? (
          <SiteStep siteIndex={siteIndex} onSelect={setSiteIndex} />
        ) : null}
        {step === 1 ? (
          <RetailerStep retailerId={retailerId} onSelect={selectRetailer} />
        ) : null}
        {step === 2 ? (
          <StoreStep
            site={site}
            retailer={retailer}
            store={store}
            storeIndex={storeIndex}
            picking={pickingStore}
            onTogglePicking={() => setPickingStore((v) => !v)}
            onSelectStore={(index) => {
              setStoreIndex(index);
              setPickingStore(false);
            }}
          />
        ) : null}
        {step === 3 ? (
          <CheckStoreStep retailer={retailer} store={store} />
        ) : null}
        {step === 4 ? <BuildAndShareStep retailer={retailer} /> : null}
      </section>

      <div className="sticky bottom-0 mt-auto border-t border-hairline bg-surface px-5 pt-3.5 pb-5">
        {last ? (
          <a
            href={storeLink(retailer, store)}
            target="_blank"
            rel="noreferrer"
            className={cn(button({ intent: "primary", size: "md" }), "w-full")}
          >
            Open the {retailer.name} website
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </a>
        ) : (
          <Button
            size="md"
            className="w-full"
            onClick={() => setStep((s) => s + 1)}
          >
            {step === 2
              ? "Looks right"
              : step === 3
                ? "Next: build & share"
                : "Continue"}
          </Button>
        )}
        {last ? (
          <p className="mt-2 text-center text-[11px] leading-relaxed text-ink-faint">
            We&apos;ll email you as soon as we read your cart.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SiteStep({
  siteIndex,
  onSelect,
}: {
  siteIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div>
      <h1 className="text-[19px] leading-snug font-semibold tracking-tight">
        Where&apos;s it going?
      </h1>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
        Pick the job site — that&apos;s where we&apos;ll deliver.
      </p>

      <div className="mt-4 space-y-2.5">
        {SITES.map((site, i) => {
          const selected = i === siteIndex;
          return (
            <button
              key={site.label}
              type="button"
              onClick={() => onSelect(i)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-card border bg-card px-4 py-3.5 text-left transition-colors",
                selected
                  ? "border-accent"
                  : "border-hairline hover:bg-card-muted",
              )}
            >
              <span
                className={cn(
                  "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-accent" : "border-hairline",
                )}
              >
                {selected ? (
                  <span className="h-2 w-2 rounded-full bg-accent" />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-ink">
                  {site.label}
                </span>
                <span className="mt-0.5 block text-[11.5px] text-ink-faint">
                  {site.address}
                </span>
              </span>
            </button>
          );
        })}

        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-2 rounded-card border border-dashed border-hairline px-4 py-3.5 text-[13px] font-medium text-accent"
        >
          <span className="text-[15px] leading-none">+</span>
          Enter a new address
        </button>
      </div>
    </div>
  );
}

function RetailerStep({
  retailerId,
  onSelect,
}: {
  retailerId: RetailerId;
  onSelect: (id: RetailerId) => void;
}) {
  return (
    <div>
      <h1 className="text-[19px] leading-snug font-semibold tracking-tight">
        Where do you want to shop?
      </h1>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
        You&apos;ll build the cart on their website. We&apos;ll show you how.
      </p>

      <div className="mt-4 space-y-2.5">
        {RETAILERS.map((retailer) => {
          const selected = retailer.id === retailerId;
          return (
            <button
              key={retailer.id}
              type="button"
              onClick={() => onSelect(retailer.id)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-card border bg-card px-4 py-3.5 text-left transition-colors",
                selected
                  ? "border-accent"
                  : "border-hairline hover:bg-card-muted",
              )}
            >
              <span
                className={cn(
                  "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-accent" : "border-hairline",
                )}
              >
                {selected ? (
                  <span className="h-2 w-2 rounded-full bg-accent" />
                ) : null}
              </span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-sunken text-[12px] font-semibold text-ink-muted">
                {retailer.name.slice(0, 1)}
              </span>
              <span className="min-w-0 text-[13px] font-medium text-ink">
                {retailer.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StoreStep({
  site,
  retailer,
  store,
  storeIndex,
  picking,
  onTogglePicking,
  onSelectStore,
}: {
  site: Site;
  retailer: Retailer;
  store: Store;
  storeIndex: number;
  picking: boolean;
  onTogglePicking: () => void;
  onSelectStore: (index: number) => void;
}) {
  return (
    <div>
      <h1 className="text-[19px] leading-snug font-semibold tracking-tight">
        We&apos;ll pick up from here
      </h1>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
        The closest {retailer.name} to {site.label}.
      </p>

      <Card className="mt-4 px-4 py-4">
        <div className="text-[15px] font-semibold tracking-tight">
          {store.name}
        </div>
        <div className="mt-1 text-[12px] text-ink-muted">
          {store.distance} mi from {site.label} · {store.hours}
        </div>
      </Card>

      <button
        type="button"
        onClick={onTogglePicking}
        className="mt-2.5 cursor-pointer text-[12.5px] font-medium text-accent"
      >
        {picking ? "Hide other stores" : "Choose another store"}
      </button>

      {picking ? (
        <div className="mt-2.5 space-y-2">
          {retailer.stores.map((option, i) => {
            const selected = i === storeIndex;
            return (
              <button
                key={option.name}
                type="button"
                onClick={() => onSelectStore(i)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-card border bg-card px-4 py-3 text-left transition-colors",
                  selected
                    ? "border-accent"
                    : "border-hairline hover:bg-card-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-accent" : "border-hairline",
                  )}
                >
                  {selected ? (
                    <span className="h-2 w-2 rounded-full bg-accent" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium text-ink">
                    {option.name}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-ink-faint">
                    {option.distance} mi from {site.label} · {option.hours}
                  </span>
                </span>
              </button>
            );
          })}
          <p className="px-1 text-[11.5px] leading-relaxed text-ink-faint">
            None of these? Call {SUPPORT_PHONE} and we&apos;ll add it.
          </p>
        </div>
      ) : null}

      <p className="mt-5 text-[11.5px] leading-relaxed text-ink-faint">
        We&apos;ll show you how to check your store on the next screen.
      </p>
    </div>
  );
}

function CheckStoreStep({
  retailer,
  store,
}: {
  retailer: Retailer;
  store: Store;
}) {
  return (
    <div>
      <h1 className="text-[19px] leading-snug font-semibold tracking-tight">
        Check your store
      </h1>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
        At the end of these steps we&apos;ll open the {retailer.name} website
        for you. We&apos;re buying from {store.name}.
      </p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
        If you see a{" "}
        <span className="font-medium text-ink">{retailer.storeAction}</span>{" "}
        button, click it.
      </p>
      <StoreDiagram retailer={retailer} store={store} />
    </div>
  );
}

function StoreDiagram({
  retailer,
  store,
}: {
  retailer: Retailer;
  store: Store;
}) {
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
          <span className="inline-flex items-center rounded-control bg-success px-2 py-1 text-[10.5px] font-semibold text-accent-ink">
            {store.hours}
          </span>

          <div className="mt-3 text-[22px] leading-tight font-bold tracking-tight text-ink">
            {store.name}
          </div>
          <div className="mt-2 text-[12px] leading-relaxed text-ink-muted">
            {store.street}
            <br />
            {store.city}, {store.state} {store.zip}
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
        What you&apos;ll see at the top of the {retailer.name} website.
      </figcaption>
    </figure>
  );
}

function BuildAndShareStep({ retailer }: { retailer: Retailer }) {
  return (
    <div>
      <h1 className="text-[19px] leading-snug font-semibold tracking-tight">
        Build &amp; share your cart
      </h1>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
        Add everything you need — but don&apos;t check out. The cart is your
        request to us. Then tap Share Cart and paste this address:
      </p>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-field border border-hairline bg-card px-3 py-2.5">
        <span className="truncate font-mono text-[12px] text-ink">{ALIAS}</span>
        <Button>
          <CopyIcon className="h-3.5 w-3.5" />
          Copy
        </Button>
      </div>

      <Shot
        caption={`The Share Cart button, inside your cart on the ${retailer.name} website.`}
      />
    </div>
  );
}

function Shot({ caption }: { caption: string }) {
  return (
    <figure className="mt-3">
      <div className="flex h-40 items-center justify-center gap-2 rounded-field border border-dashed border-hairline bg-sunken/60 text-ink-faint">
        <ImageIcon className="h-4 w-4" />
        <span className="text-[11px] font-medium tracking-widest uppercase">
          Screenshot
        </span>
      </div>
      <figcaption className="mt-2 text-[11.5px] leading-relaxed text-ink-muted">
        {caption}
      </figcaption>
    </figure>
  );
}
