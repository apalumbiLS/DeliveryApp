import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const stepNumber = cva(
  "flex shrink-0 items-center justify-center rounded-full font-semibold",
  {
    variants: {
      tone: {
        default: "h-6 w-6 bg-accent text-[13.5px] text-accent-ink",
        muted: "h-5 w-5 bg-hairline text-[12.5px] text-ink",
      },
    },
    defaultVariants: { tone: "default" },
  },
);

const stepText = cva("leading-snug", {
  variants: {
    tone: {
      default: "pt-0.5 text-[16px] text-ink",
      muted: "pt-px text-[15px] text-ink-muted",
    },
  },
  defaultVariants: { tone: "default" },
});

/**
 * Short numbered instructions, one line each, in place of a paragraph.
 * `muted` is for a preview of what comes later, not something to do now.
 */
export function StepList({
  steps,
  tone,
  className,
}: {
  steps: readonly string[];
  className?: string;
} & VariantProps<typeof stepNumber>) {
  return (
    <ol className={cn(tone === "muted" ? "space-y-2" : "space-y-3", className)}>
      {steps.map((step, i) => (
        <li key={step} className="flex items-start gap-3">
          <span className={stepNumber({ tone })}>{i + 1}</span>
          <span className={stepText({ tone })}>{step}</span>
        </li>
      ))}
    </ol>
  );
}
