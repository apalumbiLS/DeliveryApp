"use client";

import {
  AnimatePresence,
  MotionConfig,
  motion,
  type Variants,
} from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  lookupZipCentroid,
  saveOrderIntent,
  type IntentInput,
} from "@/app/portal/start/actions";
import { button } from "@/components/ui/button";
import { Chevron } from "@/components/ui/icons";
import { distanceMiles, normalizeZip } from "@/lib/geo";
import { RETAILER_IDS, type RetailerId } from "@/lib/retailers";
import { cn } from "@/lib/utils";

import { FinishStep, RetailerStep, SiteStep, StoreStep } from "./steps";
import {
  EMPTY_ADDRESS,
  formatAddress,
  isAddressComplete,
  type FlowSite,
  type FlowStore,
  type NewAddressDraft,
  type RankedStore,
} from "./types";

const STEP_COUNT = 4;

type Direction = "forward" | "back";

// The old step slides out the way the flow is moving and the new one follows
// it in from the other side. The shift stays inside the page gutter, so it
// never adds a horizontal scrollbar.
const STEP_SHIFT = 12;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const stepVariants: Variants = {
  enter: (direction: Direction) => ({
    opacity: 0,
    x: direction === "forward" ? STEP_SHIFT : -STEP_SHIFT,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.24, ease: EASE_OUT },
  },
  exit: (direction: Direction) => ({
    opacity: 0,
    x: direction === "forward" ? -STEP_SHIFT : STEP_SHIFT,
    transition: { duration: 0.14, ease: "easeIn" },
  }),
};

export function StartOrderFlow({
  sites,
  stores,
}: {
  sites: FlowSite[];
  stores: FlowStore[];
}) {
  // The page puts the likeliest site first (last used, then company default).
  const defaultSite = sites[0] ?? null;

  const [step, setStep] = useState(0);
  // Which way the last move went, so the new step slides in from that side.
  const [direction, setDirection] = useState<Direction>("forward");
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

  // The footer only pins when content runs beneath it; the sentinel sits at its
  // natural position, so while that is below the viewport the footer is stuck
  // and gets a shadow to say there is more to scroll.
  const footerSentinel = useRef<HTMLDivElement>(null);
  const [footerStuck, setFooterStuck] = useState(false);
  useEffect(() => {
    const sentinel = footerSentinel.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => {
      const viewportBottom = entry.rootBounds?.bottom ?? window.innerHeight;
      setFooterStuck(
        !entry.isIntersecting && entry.boundingClientRect.top >= viewportBottom,
      );
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

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
  ][step];

  function goTo(target: number) {
    setDirection(target < step ? "back" : "forward");
    setStep(target);
  }

  function clearIntent() {
    setIntentId(null);
    setIntentAddress(null);
  }

  async function saveAndAdvance() {
    setError(null);

    if (intentId && intentAddress) {
      goTo(3);
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
    goTo(3);
  }

  function next() {
    // Leaving the store step saves the intent, which is what mints the
    // address the last step hands out.
    if (step === 2) {
      void saveAndAdvance();
      return;
    }
    setError(null);
    goTo(Math.min(STEP_COUNT - 1, step + 1));
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              goTo(Math.max(0, step - 1));
            }}
            className="-my-3 flex cursor-pointer items-center gap-1 py-3 text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <Chevron className="h-3.5 w-3.5 rotate-180" />
            Back
          </button>
        ) : (
          <span className="text-[13.5px] font-medium text-ink-muted">
            Start an order
          </span>
        )}

        <span className="text-[12px] font-semibold tracking-[0.14em] text-ink-faint uppercase">
          Step {step + 1} of {STEP_COUNT}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {Array.from({ length: STEP_COUNT }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none",
              index <= step ? "bg-accent" : "bg-sunken",
            )}
          />
        ))}
      </div>

      {/*
       * One step at a time: the next mounts once the last has slid out, and
       * the page returns to the top in between so it never jumps mid-slide.
       * Reduced motion drops the slide and keeps the fade.
       */}
      <MotionConfig reducedMotion="user">
        <AnimatePresence
          mode="wait"
          initial={false}
          custom={direction}
          onExitComplete={() => window.scrollTo({ top: 0 })}
        >
          <motion.section
            key={step}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="mt-6"
          >
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
              <FinishStep
                retailerId={activeRetailerId}
                store={activeEntry}
                alias={intentId ? intentAddress : null}
              />
            ) : null}
          </motion.section>
        </AnimatePresence>
      </MotionConfig>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-field bg-danger-bg px-3 py-2 text-[14px] leading-relaxed text-danger-ink"
        >
          {error}
        </p>
      ) : null}

      {/*
       * Always at the bottom of the screen: the flow fills the page and the
       * spacer pushes the footer down on a short step, and sticky pins it when a
       * step outgrows the screen (the new address form on a phone). The negative
       * margins carry it across the page gutter and over the page's bottom
       * padding, so it sits flush in both cases. The last step has no footer:
       * its actions are in its checklist.
       */}
      {step < STEP_COUNT - 1 ? (
        <div aria-hidden className="min-h-8 flex-1" />
      ) : null}
      {step < STEP_COUNT - 1 ? (
        <div
          className={cn(
            "sticky bottom-0 -mx-5 -mb-6 flex flex-col gap-2 border-t border-hairline-soft bg-card-muted px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] transition-shadow",
            footerStuck && "shadow-footer",
          )}
        >
          <button
            type="button"
            onClick={next}
            disabled={!canContinue || saving}
            className={cn(button({ intent: "primary", size: "md" }), "w-full")}
          >
            {saving ? "Saving…" : "Continue"}
          </button>

          <p className="text-center text-[13px] leading-relaxed text-ink-faint">
            Nothing is ordered until you approve the price.
          </p>
        </div>
      ) : null}
      <div ref={footerSentinel} aria-hidden className="h-px" />
    </div>
  );
}
