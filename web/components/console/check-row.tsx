import type { ReactNode } from "react";

import { AlertIcon, CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export type CheckState = "pass" | "warn" | "fail" | "todo";

const CHECK_STYLES: Record<CheckState, string> = {
  pass: "bg-success-bg text-success-ink",
  warn: "bg-warning-bg text-warning-ink",
  fail: "bg-danger-bg text-danger-ink",
  todo: "bg-sunken text-ink-faint",
};

export function CheckDot({ state }: { state: CheckState }) {
  return (
    <span
      className={cn(
        "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full",
        CHECK_STYLES[state],
      )}
    >
      {state === "pass" ? (
        <CheckIcon className="h-2.5 w-2.5" />
      ) : state === "todo" ? (
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      ) : (
        <AlertIcon className="h-2.5 w-2.5" />
      )}
    </span>
  );
}

/** One verification check — the dispatcher's actual unit of work. */
export function CheckRow({
  state,
  label,
  detail,
  children,
}: {
  state: CheckState;
  label: string;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 border-t border-hairline-soft py-2.5 first:border-t-0 first:pt-1">
      <CheckDot state={state} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[12.5px] font-medium text-ink">{label}</span>
        </div>
        {detail ? (
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">
            {detail}
          </p>
        ) : null}
        {children ? <div className="mt-2">{children}</div> : null}
      </div>
    </div>
  );
}
