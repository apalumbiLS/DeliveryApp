"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

function readHidden(storageKey: string) {
  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

function writeHidden(storageKey: string) {
  try {
    window.localStorage.setItem(storageKey, "1");
  } catch {
    // Storage can be blocked; they'll just see the dialog next time.
  }
}

/**
 * A briefing that opens over the page until the dispatcher dismisses it, and
 * stays away once they tick "Don't show this again".
 *
 * Per device, not per account, like the portal's finish explainer: a pilot
 * shortcut that needs no migration. Opened from an effect because storage is
 * only readable in the browser; the server renders it closed.
 */
export function IntroDialog({
  storageKey,
  title,
  icon,
  children,
}: {
  storageKey: string;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [hideNextTime, setHideNextTime] = useState(false);

  useEffect(() => {
    const el = dialog.current;
    if (!el || readHidden(storageKey)) return;
    el.showModal();
    // The page behind shouldn't scroll under a modal.
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    // Guarded because `close` is dispatched later: a close queued by a
    // previous run must not unlock scrolling under a dialog open again.
    const restore = () => {
      if (!el.open) root.style.overflow = previous;
    };
    el.addEventListener("close", restore);
    return () => {
      el.removeEventListener("close", restore);
      if (el.open) el.close();
      root.style.overflow = previous;
    };
  }, [storageKey]);

  return (
    <dialog
      ref={dialog}
      aria-label={title}
      // Fires for "Got it" and for Escape alike, so both honour the checkbox.
      onClose={() => {
        if (hideNextTime) writeHidden(storageKey);
      }}
      className="m-auto w-md max-w-[calc(100vw-2rem)] rounded-card border-0 bg-card p-0 text-ink shadow-card backdrop:bg-ink/60"
    >
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          {icon}
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        </div>
        <div className="mt-3">{children}</div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline-soft px-5 py-3.5">
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-muted">
          <input
            type="checkbox"
            checked={hideNextTime}
            onChange={(event) => setHideNextTime(event.target.checked)}
            className="h-3.5 w-3.5 accent-accent"
          />
          Don&apos;t show this again
        </label>
        <Button size="md" onClick={() => dialog.current?.close()}>
          Got it
        </Button>
      </div>
    </dialog>
  );
}
