import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export type ButtonIntent = "primary" | "secondary" | "neutral" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export const button = cva(
  "inline-flex cursor-pointer items-center justify-center gap-1.5 font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      intent: {
        primary: "bg-accent text-accent-ink hover:bg-accent-hover",
        secondary:
          "border border-hairline bg-card text-ink hover:bg-card-muted",
        // Filled grey: a save beside the fields it saves. Easy to find, but it
        // never competes with the page's one primary action.
        neutral: "bg-sunken text-ink hover:bg-hairline",
        ghost: "text-ink-muted hover:bg-sunken hover:text-ink",
      } satisfies Record<ButtonIntent, string>,
      size: {
        sm: "rounded-control px-2.5 py-1.5 text-[11.5px]",
        md: "rounded-control px-4 py-2.5 text-[13px]",
        lg: "rounded-control px-5 py-3.5 text-[15px]",
      } satisfies Record<ButtonSize, string>,
    },
    defaultVariants: { intent: "primary", size: "sm" },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof button>;

export function Button({
  className,
  intent,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(button({ intent, size }), className)}
      {...props}
    />
  );
}
