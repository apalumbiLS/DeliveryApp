import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Th({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-3.5 py-2 text-left text-[10.5px] font-semibold tracking-widest text-ink-faint uppercase",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-3.5 py-2 align-middle", className)}>{children}</td>
  );
}
