"use client";

import type { MouseEvent } from "react";

import { button } from "@/components/ui/button";
import { PinIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * Where the phone's own maps app takes over: on Android a `geo:` link opens
 * the driver's default maps app (or asks which), and on iPhone and iPad an
 * Apple Maps link opens Maps. Anywhere else, Google Maps in a new tab.
 */
function nativeMapsUrl(query: string): string | null {
  const agent = navigator.userAgent;
  const q = encodeURIComponent(query);
  if (/Android/i.test(agent)) return `geo:0,0?q=${q}`;
  // iPadOS reports itself as a Mac; touch tells them apart.
  const iOS =
    /iPhone|iPad|iPod/.test(agent) ||
    (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1);
  return iOS ? `https://maps.apple.com/?q=${q}` : null;
}

export function NavigateLink({
  query,
  className,
}: {
  /** The place to search for: a name and address. */
  query: string;
  className?: string;
}) {
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    const native = nativeMapsUrl(query);
    if (!native) return;
    event.preventDefault();
    window.location.href = native;
  }

  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      className={cn(button({ intent: "secondary", size: "md" }), className)}
    >
      <PinIcon className="h-4 w-4" />
      Navigate
    </a>
  );
}
