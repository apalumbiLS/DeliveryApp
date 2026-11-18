"use client";

import { useEffect } from "react";

/**
 * Why an order action did not happen, from the `?error=` its redirect added.
 *
 * Shown once: the parameter comes out of the address straight away, so a
 * refresh or the next save does not bring back an error that is already
 * fixed.
 */
export function ActionError({ message }: { message: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("error")) return;
    url.searchParams.delete("error");
    window.history.replaceState(window.history.state, "", url);
    // No dependency list: the same action can fail twice in a row while this
    // stays mounted, and each failure puts `?error=` back.
  });

  return (
    <p
      role="alert"
      className="mb-2.5 rounded-control bg-danger-bg px-2.5 py-1.5 text-[11.5px] font-medium text-danger-ink"
    >
      {message}
    </p>
  );
}
