import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A read-only field: a value that reads as editable but is not. */
export function Field({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-control border border-hairline bg-card px-2.5 py-1.5 text-[12.5px] text-ink",
        className,
      )}
    >
      {children}
    </div>
  );
}
