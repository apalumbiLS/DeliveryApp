"use client";

import { Button } from "@/components/ui/button";
import { releaseDriver } from "@/lib/dispatch/actions";

/**
 * Takes the job back from its driver and posts it again. Confirmed first: the
 * driver loses the job, and nothing tells them yet.
 */
export function ReleaseDriver({ orderId }: { orderId: string }) {
  return (
    <form
      action={releaseDriver}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Take this job back from the driver and post it to drivers again? The driver isn't notified, so call them.",
          )
        ) {
          event.preventDefault();
        }
      }}
      className="shrink-0"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <Button type="submit" intent="secondary" size="sm">
        Release driver
      </Button>
    </form>
  );
}
