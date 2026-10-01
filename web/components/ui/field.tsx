import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Label } from "./label";

/** The wiring the control must spread so the label and messages stay attached. */
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

/**
 * Label + control + hint/error.
 *
 * The control is a render prop rather than a child element so the ids and
 * `aria-*` links are generated once here and cannot drift out of sync with the
 * messages rendered below.
 */
export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {hint ? (
        <p id={hintId} className="text-[11.5px] leading-relaxed text-ink-faint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          className="text-[11.5px] leading-relaxed text-danger-ink"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
