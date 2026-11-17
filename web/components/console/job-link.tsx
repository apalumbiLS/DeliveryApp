"use client";

import { useEffect, useState } from "react";

import { button } from "@/components/ui/button";
import { CheckIcon, CopyIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * The link a driver opens to see the job and accept it. No text goes out yet,
 * so the dispatcher copies it and sends it themselves.
 */
export function JobLink({ orderId }: { orderId: string }) {
  const [state, setState] = useState<"idle" | "copied" | "again" | "failed">(
    "idle",
  );
  const [copies, setCopies] = useState(0);
  const path = `/driver/jobs/${orderId}`;

  // Restarts on every copy, so a second click shows the check for its own
  // full three seconds.
  useEffect(() => {
    if (state !== "copied") return;
    const timer = window.setTimeout(() => setState("again"), 3000);
    return () => window.clearTimeout(timer);
  }, [state, copies]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setState("copied");
      setCopies((count) => count + 1);
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex items-center gap-2">
      {state === "failed" ? (
        <span className="text-[11px] text-warning-ink">
          Couldn&apos;t copy. Open it and copy the address.
        </span>
      ) : null}
      <a
        href={path}
        target="_blank"
        rel="noreferrer"
        className={button({ intent: "secondary", size: "sm" })}
      >
        Open
      </a>
      {/* A minimum width, so "Copied" does not shift the controls beside it. */}
      <button
        type="button"
        onClick={copy}
        className={cn(button({ size: "sm" }), "min-w-32")}
      >
        {state === "copied" ? (
          <>
            <CheckIcon className="h-3.5 w-3.5" />
            Copied
          </>
        ) : (
          <>
            <CopyIcon className="h-3.5 w-3.5" />
            {state === "again" ? "Copy again" : "Copy job link"}
          </>
        )}
      </button>
    </div>
  );
}
