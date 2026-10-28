"use client";

import { Ban, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
 * Real captures of Lowe's, recorded October 2026, for the start flow's
 * tutorial (finish-tutorial.tsx). A pilot shortcut: if Lowe's redesigns, these
 * go stale and need re-capturing. Where phone and desktop differ enough — on a
 * phone the store button sits two screens below a map — each gets its own.
 */

/** Where to look in a capture, as shares of its size. */
type SpotlightBox = {
  left: string;
  top: string;
  width: string;
  height: string;
};

/**
 * A capture with an amber ring on the thing to tap. Amber, not the accent:
 * Lowe's own buttons are blue, and a blue ring reads as part of their page.
 * The slow zoom leans in toward the ring, so the eye ends up where the ring is.
 */
function Shot({
  src,
  width,
  height,
  alt,
  spotlight,
  className,
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
  spotlight: SpotlightBox;
  className?: string;
}) {
  const originX = `calc(${spotlight.left} + ${spotlight.width} / 2)`;
  const originY = `calc(${spotlight.top} + ${spotlight.height} / 2)`;

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-field border border-hairline bg-card",
        className,
      )}
      // Never wider than the capture itself, so a wide panel can't blur it.
      style={{ maxWidth: width }}
    >
      <div
        className="relative motion-safe:animate-tutorial-zoom"
        style={{ transformOrigin: `${originX} ${originY}` }}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="block h-auto w-full"
        />
        <span
          aria-hidden
          className="absolute rounded-control border-2 border-warning motion-safe:animate-pulse"
          style={spotlight}
        />
      </div>
    </div>
  );
}

/**
 * Lowe's search results header, drawn rather than captured: it's three plain
 * buttons, and drawing it lets the ring wrap the real button exactly instead of
 * being placed over a picture by eye.
 */
export function LowesPickupTodayShot() {
  return (
    <div
      role="img"
      aria-label="Lowe's search results, with the Pickup Today filter"
      className="w-full max-w-sm overflow-hidden rounded-field border border-hairline bg-card px-4 pt-3.5 pb-4"
    >
      <div className="text-[17px] font-semibold text-ink">paint brush</div>
      <div className="mt-0.5 text-[12px] text-ink-muted">1280 results</div>
      <div className="mt-3.5 flex gap-2.5 pt-1 pl-1">
        <LowesChip>
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          Filters
        </LowesChip>
        <LowesChip ringed>Pickup Today</LowesChip>
        <LowesChip>Top Deals</LowesChip>
      </div>
    </div>
  );
}

function LowesChip({
  ringed,
  children,
}: {
  ringed?: boolean;
  children: ReactNode;
}) {
  return (
    <span className="relative inline-flex shrink-0 items-center gap-1.5 rounded-control border border-ink/70 bg-card px-3 py-2 text-[12.5px] font-medium whitespace-nowrap text-ink">
      {children}
      {ringed ? (
        <span
          aria-hidden
          className="absolute -inset-1.5 rounded-[0.75rem] border-2 border-warning motion-safe:animate-pulse"
        />
      ) : null}
    </span>
  );
}

export function LowesCartIconShot() {
  return (
    <Shot
      src="/how-to/lowes-cart-icon-phone.webp"
      width={384}
      height={42}
      alt="The top of Lowe's site, with the cart icon"
      spotlight={{
        left: "89.6%",
        top: "11.9%",
        width: "9.9%",
        height: "78.6%",
      }}
    />
  );
}

export function LowesShareButtonShot() {
  return (
    <>
      <Shot
        src="/how-to/lowes-cart-share-phone.webp"
        width={375}
        height={55}
        alt="The top of a Lowe's cart on a phone, with the envelope icon"
        spotlight={{ left: "45%", top: "20%", width: "10%", height: "62%" }}
        className="md:hidden"
      />
      <Shot
        src="/how-to/lowes-cart-share-desktop.webp"
        width={540}
        height={60}
        alt="The top of a Lowe's cart on a computer, with the Share link"
        spotlight={{ left: "58%", top: "18%", width: "17%", height: "62%" }}
        className="hidden md:block"
      />
    </>
  );
}

export function LowesEmailFormShot() {
  return (
    <Shot
      src="/how-to/lowes-email-cart-phone.webp"
      width={375}
      height={207}
      alt="Lowe's Email Cart form, with the recipient's email address field"
      spotlight={{ left: "5.5%", top: "37.5%", width: "85%", height: "25%" }}
    />
  );
}

/** Lowe's checkout button, struck through. */
export function LowesCheckoutShot() {
  return (
    <div className="relative max-w-[22rem]">
      <Image
        src="/how-to/lowes-checkout-phone.webp"
        alt="Lowe's Start Secure Checkout button"
        width={375}
        height={58}
        className="block h-auto w-full opacity-60 md:hidden"
      />
      <Image
        src="/how-to/lowes-checkout-desktop.webp"
        alt="Lowe's Start Secure Checkout button"
        width={352}
        height={62}
        className="hidden h-auto w-full opacity-60 md:block"
      />
      <span
        aria-hidden
        className="absolute inset-x-[3%] top-1/2 h-1 -rotate-6 rounded-full bg-danger"
      />
      <span
        aria-hidden
        className="absolute -top-3 -right-3 flex size-8 items-center justify-center rounded-full bg-card text-danger shadow-card"
      >
        <Ban className="h-5 w-5" />
      </span>
    </div>
  );
}

/**
 * Setting the store: a clip on phones, a before/after on computers. The
 * tutorial plays it once and pauses it with everything else.
 */
export function LowesSetStoreDemo({ paused = false }: { paused?: boolean }) {
  return (
    <>
      <PhoneClip paused={paused} />
      <DesktopBeforeAfter />
    </>
  );
}

/**
 * Where "Set as My Store" sits in the clip once the scroll settles, as shares
 * of the video's box, and when (in clip seconds). Read off the frames of
 * lowes-set-store-phone.mp4: still from about 3.9s, tapped at 5.35s, gone by
 * 5.5s. Re-read these if the clip is ever re-recorded.
 */
const CLIP_BUTTON = { left: "5%", top: "75.8%", width: "90%", height: "6.4%" };
const CLIP_SETTLED = 3.9;
const CLIP_TAP = 5.25;
const CLIP_GONE = 5.7;

type ClipMoment = "scrolling" | "settled" | "tap" | "after";

function clipMoment(time: number): ClipMoment {
  if (time < CLIP_SETTLED) return "scrolling";
  if (time < CLIP_TAP) return "settled";
  if (time < CLIP_GONE) return "tap";
  return "after";
}

function PhoneClip({ paused }: { paused: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [moment, setMoment] = useState<ClipMoment>("scrolling");

  // Follow the video's own clock rather than a timer, so the highlight stays
  // on the button even if the clip starts late or is paused and resumed.
  useEffect(() => {
    let frame = 0;
    const follow = () => {
      const el = video.current;
      if (el) setMoment(clipMoment(el.currentTime));
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, []);

  const lit = moment === "settled" || moment === "tap";

  // Autoplay ignores reduced motion, so honour it here: hand over the controls.
  useEffect(() => {
    const el = video.current;
    if (!el || !window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    el.pause();
    el.controls = true;
  }, []);

  useEffect(() => {
    const el = video.current;
    if (!el || el.controls) return;
    if (paused) el.pause();
    else void el.play().catch(() => {});
  }, [paused]);

  return (
    // Sized by the screen's height, not a fixed width: as large as fits
    // between the tutorial's title and its controls on any phone.
    <div className="mx-auto aspect-[384/800] h-[clamp(16rem,calc(100dvh-22rem),30rem)] overflow-hidden rounded-[1.25rem] border-4 border-ink/85 bg-ink/85 md:hidden">
      <div className="relative h-full w-full overflow-hidden rounded-[1rem]">
        <video
          ref={video}
          src="/how-to/lowes-set-store-phone.mp4"
          width={384}
          height={800}
          autoPlay
          muted
          playsInline
          preload="auto"
          aria-label="Scrolling down a Lowe's store page on a phone and tapping Set as My Store"
          className="block h-full w-full object-cover"
        />
        {/* Dim everything but the button, ring it, then show the tap. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute rounded-md border-2 border-warning shadow-[0_0_0_100vmax_rgb(15_23_42/0.45)] transition-opacity duration-300",
            lit ? "opacity-100" : "opacity-0",
          )}
          style={CLIP_BUTTON}
        />
        {moment === "tap" ? (
          <span
            aria-hidden
            className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-warning/70 motion-safe:animate-ping"
            style={{ left: "50%", top: "79%" }}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Button position in the cropped capture, as a share of its size. */
const DESKTOP_BUTTON = { left: "13.7%", top: "82.2%" };

function DesktopBeforeAfter() {
  return (
    <div
      className="relative hidden w-full overflow-hidden rounded-field border border-hairline bg-card md:block"
      role="img"
      aria-label="A Lowe's store page on a computer: clicking Set as My Store replaces the button and the page then reads Your Store"
    >
      <Image
        src="/how-to/lowes-set-store-desktop-before.webp"
        alt=""
        width={930}
        height={490}
        className="block h-auto w-full"
      />
      <Image
        src="/how-to/lowes-set-store-desktop-after.webp"
        alt=""
        width={930}
        height={490}
        className="absolute inset-0 h-auto w-full opacity-0 motion-safe:animate-demo-after"
      />
      <span
        aria-hidden
        className="absolute size-8 rounded-full border-2 border-warning opacity-0 motion-safe:animate-demo-tap"
        style={DESKTOP_BUTTON}
      />
    </div>
  );
}
