import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A numbered step: header, optional status, content. */
export function Band({
  title,
  status,
  children,
  className,
}: {
  title: string;
  status?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-card border border-hairline bg-card shadow-card",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-hairline-soft bg-card-muted px-3.5 py-2">
        <span className="text-[10.5px] font-semibold tracking-widest text-ink-faint uppercase">
          {title}
        </span>
        {status}
      </div>
      <div className="px-3.5 py-3">{children}</div>
    </section>
  );
}
