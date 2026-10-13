"use client";

import { useEffect, useMemo, useState } from "react";

import {
  lookupZipCentroid,
  saveOrderIntent,
  type IntentInput,
} from "@/app/portal/start/actions";
import { button } from "@/components/ui/button";
import { Chevron, ExternalLinkIcon } from "@/components/ui/icons";
import { distanceMiles, normalizeZip } from "@/lib/geo";
import { RETAILER_IDS, RETAILERS, type RetailerId } from "@/lib/retailers";
import { cn } from "@/lib/utils";

import {
  BuildShareStep,
  CheckStoreStep,
  RetailerStep,
  SiteStep,
  StoreStep,
} from "./steps";
import {
  EMPTY_ADDRESS,
  formatAddress,
  isAddressComplete,
  type FlowSite,
  type FlowStore,
  type NewAddressDraft,
  type RankedStore,
} from "./types";

const STEP_COUNT = 5;

export function StartOrderFlow({
  sites,
  stores,
}: {
  sites: FlowSite[];
  stores: FlowStore[];
}) {
  const defaultSite = sites.find((site) => site.isDefault) ?? sites[0] ?? null;

  const [step, setStep] = useState(0);
  const [siteMode, setSiteMode] = useState<"saved" | "new">("saved");
  const [savedSiteId, setSavedSiteId] = useState<string | null>(
    defaultSite?.id ?? null,
  );
  const [address, setAddress] = useState<NewAddressDraft>(EMPTY_ADDRESS);
  const [retailerId, setRetailerId] = useState<RetailerId | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [intentAddress, setIntentAddress] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zipResolution, setZipResolution] = useState<{
    zip: string;
    point: { lat: number; lng: number } | null;
  } | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  // A new address has no coordinates of its own, so borrow the ZIP's. Resolved
  // once the ZIP is complete, which is what lets a new address rank stores by
  // distance like a saved one.
  const newZip = siteMode === "new" ? normalizeZip(address.postalCode) : null;

  useEffect(() => {
    if (!newZip) return;

    let cancelled = false;

    void lookupZipCentroid(newZip).then((point) => {
      if (!cancelled) setZipResolution({ zip: newZip, point });
    });

    return () => {
      cancelled = true;
    };
  }, [newZip]);

  // Keyed by ZIP, so a slow lookup can never be applied to a different one.
  const newAddressPoint =
    newZip && zipResolution?.zip === newZip ? zipResolution.point : null;

  // A retailer is selectable once it has at least one store to pick up from.
  // The rest are still listed, marked unavailable, so the page says where we're
  // going as well as where we are. Seeding stores is what promotes one.
  const { availableRetailers, unavailableRetailers } = useMemo(() => {
    const hasStores = (id: RetailerId) =>
      stores.some((store) => store.retailer === id);

    return {
      availableRetailers: RETAILER_IDS.filter(hasStores),
      unavailableRetailers: RETAILER_IDS.filter((id) => !hasStores(id)),
    };
  }, [stores]);

  const activeRetailerId = retailerId ?? availableRetailers[0] ?? null;

  const savedSitePoint = useMemo(() => {
    if (siteMode !== "saved") return null;
    const site = sites.find((entry) => entry.id === savedSiteId);
    return site?.lat != null && site.lng != null
      ? { lat: site.lat, lng: site.lng }
      : null;
  }, [siteMode, savedSiteId, sites]);

  const sitePoint = siteMode === "saved" ? savedSitePoint : newAddressPoint;

  const ranked = useMemo<RankedStore[]>(() => {
    const forRetailer = stores.filter(
      (store) => store.retailer === activeRetailerId,
    );

    return forRetailer
      .map((store) => ({
        store,
        miles:
          sitePoint && store.lat != null && store.lng != null
            ? distanceMiles(sitePoint, { lat: store.lat, lng: store.lng })
            : null,
      }))
      .sort((a, b) => {
        if (a.miles === null && b.miles === null)
          return a.store.name.localeCompare(b.store.name);
        if (a.miles === null) return 1;
        if (b.miles === null) return -1;
        return a.miles - b.miles;
      });
  }, [stores, activeRetailerId, sitePoint]);

  // Derived rather than stored, so changing the site or retailer can never
  // leave a store selected that is no longer in the list.
  const activeStoreId =
    storeId && ranked.some((entry) => entry.store.id === storeId)
      ? storeId
      : (ranked[0]?.store.id ?? null);

  const activeEntry =
    ranked.find((entry) => entry.store.id === activeStoreId) ??
    ranked[0] ??
    null;

  const selectedSite =
    siteMode === "saved"
      ? (sites.find((site) => site.id === savedSiteId) ?? null)
      : null;

  const siteLabel =
    siteMode === "new"
      ? "your new address"
      : (selectedSite?.label ??
        (selectedSite ? formatAddress(selectedSite) : "your site"));

  const canContinue = [
    siteMode === "saved" ? Boolean(savedSiteId) : isAddressComplete(address),
    activeRetailerId !== null,
    activeStoreId !== null,
    true,
    true,
  ][step];

  function clearIntent() {
    setIntentId(null);
    setIntentAddress(null);
  }

  async function saveAndAdvance() {
    setError(null);

    if (intentId && intentAddress) {
      setStep(4);
      return;
    }

    if (!activeRetailerId || !activeStoreId) return;

    const site: IntentInput["site"] | null =
      siteMode === "saved"
        ? savedSiteId
          ? { kind: "saved", siteId: savedSiteId }
          : null
        : {
            kind: "new",
            label: address.label.trim() || null,
            line1: address.line1,
            line2: address.line2 || null,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
          };

    if (!site) return;

    setSaving(true);
    const result = await saveOrderIntent({
      retailer: activeRetailerId,
      storeId: activeStoreId,
      site,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setIntentId(result.intentId);
    setIntentAddress(result.orderAddress);
    setStep(4);
  }

  function next() {
    if (step === 3) {
      void saveAndAdvance();
      return;
    }
    setError(null);
    setStep((current) => Math.min(STEP_COUNT - 1, current + 1));
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep((current) => Math.max(0, current - 1));
            }}
            className="flex cursor-pointer items-center gap-1 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <Chevron className="h-3.5 w-3.5 rotate-180" />
            Back
          </button>
        ) : (
          <span className="text-[12px] font-medium text-ink-muted">
            Start an order
          </span>
        )}

        <span className="text-[10.5px] font-semibold tracking-[0.14em] text-ink-faint uppercase">
          Step {step + 1} of {STEP_COUNT}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {Array.from({ length: STEP_COUNT }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full",
              index <= step ? "bg-accent" : "bg-sunken",
            )}
          />
        ))}
      </div>

      <section className="mt-6">
        {step === 0 ? (
          <SiteStep
            sites={sites}
            mode={siteMode}
            savedSiteId={savedSiteId}
            address={address}
            onSelectSaved={(id) => {
              clearIntent();
              setSiteMode("saved");
              setSavedSiteId(id);
            }}
            onSelectNew={() => {
              clearIntent();
              setSiteMode("new");
            }}
            onAddressChange={(patch) => {
              clearIntent();
              setAddress((current) => ({ ...current, ...patch }));
            }}
          />
        ) : null}

        {step === 1 ? (
          <RetailerStep
            retailers={availableRetailers}
            unavailable={unavailableRetailers}
            value={activeRetailerId}
            onChange={(id) => {
              clearIntent();
              setRetailerId(id);
              setStoreId(null);
            }}
          />
        ) : null}

        {step === 2 ? (
          <StoreStep
            ranked={ranked}
            value={activeStoreId}
            siteLabel={siteLabel}
            hasCoordinates={sitePoint !== null}
            onChange={(id) => {
              clearIntent();
              setStoreId(id);
            }}
          />
        ) : null}

        {step === 3 && activeRetailerId && activeEntry ? (
          <CheckStoreStep
            retailerId={activeRetailerId}
            store={activeEntry}
            onChangeStore={() => {
              setError(null);
              setStep(2);
            }}
          />
        ) : null}

        {step === 4 && activeRetailerId && activeEntry ? (
          <BuildShareStep
            retailerId={activeRetailerId}
            store={activeEntry}
            alias={intentId ? intentAddress : null}
          />
        ) : null}
      </section>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-field bg-danger-bg px-3 py-2 text-[12.5px] leading-relaxed text-danger-ink"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-2 border-t border-hairline-soft pt-5">
        {step < STEP_COUNT - 1 ? (
          <button
            type="button"
            onClick={next}
            disabled={!canContinue || saving}
            className={cn(button({ intent: "primary", size: "md" }), "w-full")}
          >
            {saving
              ? "Saving…"
              : step === 3
                ? "Next: build & share"
                : "Continue"}
          </button>
        ) : activeRetailerId && activeEntry ? (
          <a
            href={
              activeEntry.store.storeUrl ?? RETAILERS[activeRetailerId].homeUrl
            }
            target="_blank"
            rel="noreferrer"
            className={cn(button({ intent: "primary", size: "md" }), "w-full")}
          >
            Open the {RETAILERS[activeRetailerId].label} website
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </a>
        ) : null}

        <p className="text-center text-[11.5px] leading-relaxed text-ink-faint">
          {step < STEP_COUNT - 1
            ? "Nothing is ordered until you approve the price."
            : "We'll email you as soon as we read your cart."}
        </p>
      </div>
    </div>
  );
}
