import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A label/value row — quotes, price breakdowns, summaries. */
export function Row({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span
        className={cn(
          "text-[12.5px]",
          strong ? "font-semibold text-ink" : "text-ink-muted",
        )}
      >
        {label}
        {hint ? (
          <span className="ml-2 text-[11px] text-ink-faint">{hint}</span>
        ) : null}
      </span>
      <span
        className={cn(
          "tabular-nums",
          strong
            ? "text-[14px] font-semibold text-ink"
            : "text-[12.5px] text-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}
