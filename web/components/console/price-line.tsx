import { Field } from "@/components/console/field";

/** A fee line: a label with a reason beside it, and an optional input. */
export function PriceLine({
  label,
  value,
  hint,
  input,
}: {
  label: string;
  value: string;
  hint?: string;
  input?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="truncate text-[11.5px] text-ink-muted">
        {label}
        {hint ? (
          <span className="ml-1.5 text-[10.5px] text-ink-faint">{hint}</span>
        ) : null}
      </span>
      {input ? (
        <Field className="w-20 px-2 py-1 text-right text-[12px] tabular-nums">
          {value}
        </Field>
      ) : (
        <span className="text-[12px] text-ink tabular-nums">{value}</span>
      )}
    </div>
  );
}
