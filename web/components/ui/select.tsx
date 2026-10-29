import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { Chevron } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export const select = cva(
  "w-full appearance-none rounded-field border bg-card px-3 py-2.5 pr-9 text-[15px] text-ink transition-colors outline-none pointer-coarse:text-base disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      invalid: {
        true: "border-danger focus-visible:ring-2 focus-visible:ring-danger/25",
        false:
          "border-hairline focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25",
      },
    },
    defaultVariants: { invalid: false },
  },
);

type SelectProps = ComponentProps<"select"> & VariantProps<typeof select>;

/** Native select on the design tokens, with a positioned chevron. */
export function Select({
  className,
  invalid,
  children,
  ...props
}: SelectProps) {
  return (
    <span className="relative block">
      <select className={cn(select({ invalid }), className)} {...props}>
        {children}
      </select>
      <Chevron
        className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 rotate-90 text-ink-faint"
        aria-hidden
      />
    </span>
  );
}
