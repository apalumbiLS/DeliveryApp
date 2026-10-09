import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A card with a quiet uppercase header — the console's panel unit. */
export function Panel({
  title,
  note,
  children,
  className,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-hairline bg-card shadow-card",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-hairline-soft bg-card-muted px-3.5 py-2.5">
        <span className="text-[10.5px] font-semibold tracking-widest text-ink-faint uppercase">
          {title}
        </span>
        {note ? (
          <span className="text-[11.5px] text-ink-faint">{note}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
