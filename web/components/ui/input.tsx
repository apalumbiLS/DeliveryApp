import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const input = cva(
  "w-full rounded-field border bg-card px-3 py-2.5 text-[15px] text-ink transition-colors outline-none pointer-coarse:text-base placeholder:text-ink-faint disabled:cursor-not-allowed disabled:opacity-60",
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

type InputProps = ComponentProps<"input"> & VariantProps<typeof input>;

export function Input({ className, invalid, ...props }: InputProps) {
  return <input className={cn(input({ invalid }), className)} {...props} />;
}
