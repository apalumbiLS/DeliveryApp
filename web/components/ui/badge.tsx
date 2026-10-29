import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/tokens";

export type BadgeTone = Tone | "accent";
export type BadgeSize = "sm" | "md";

export const badge = cva(
  "inline-flex items-center rounded-full font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-neutral-bg text-neutral-ink",
        info: "bg-info-bg text-info-ink",
        success: "bg-success-bg text-success-ink",
        warning: "bg-warning-bg text-warning-ink",
        danger: "bg-danger-bg text-danger-ink",
        accent: "bg-accent-soft text-accent-soft-ink",
      } satisfies Record<BadgeTone, string>,
      size: {
        sm: "px-2 py-0.5 text-[12.5px]",
        md: "px-2.5 py-1 text-[13.5px]",
      } satisfies Record<BadgeSize, string>,
      bordered: {
        true: "inset-ring-1 inset-ring-current/20",
        false: "",
      },
    },
    defaultVariants: { tone: "neutral", size: "sm", bordered: false },
  },
);

type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badge>;

export function Badge({
  className,
  tone,
  size,
  bordered,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badge({ tone, size, bordered }), className)}
      {...props}
    />
  );
}
