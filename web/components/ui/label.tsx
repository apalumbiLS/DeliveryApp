import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("block text-[12.5px] font-medium text-ink", className)}
      {...props}
    />
  );
}
