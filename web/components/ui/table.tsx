import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** A table sized to its container. Wrap in a Card to give it a shell. */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <table
      className={cn("w-full border-collapse text-left text-[15px]", className)}
      {...props}
    />
  );
}

/** Column headings. Quiet, uppercase, and not sortable yet. */
export function THead({ className, ...props }: ComponentProps<"thead">) {
  return (
    <thead
      className={cn("border-b border-hairline bg-card-muted", className)}
      {...props}
    />
  );
}

/** Data rows, divided by a soft hairline rather than a border per row. */
export function TBody({ className, ...props }: ComponentProps<"tbody">) {
  return (
    <tbody
      className={cn("divide-y divide-hairline-soft", className)}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("hover:bg-card-muted", className)} {...props} />;
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-[12.5px] font-medium tracking-[0.08em] text-ink-faint uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 text-ink", className)} {...props} />;
}
