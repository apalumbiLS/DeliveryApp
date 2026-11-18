"use client";

import { useEffect, useRef, useState } from "react";

import { cents } from "@/lib/dispatch/draft-input";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** The fields of the enclosing form that add up to the total. */
const PARTS = ["materials", "sizing", "mileage"];

/**
 * The order total, recomputed as the dispatcher types into the enclosing
 * form's price fields, so it never shows a stale sum before saving. Mirrors
 * `update_dispatcher_draft`: the parts plus tax, less discount, never below 0.
 */
export function LiveTotal({
  savedCents,
  adjustmentCents,
}: {
  /** The total as saved, shown until a field changes. */
  savedCents: number;
  /** Tax less discount, which the form does not edit. */
  adjustmentCents: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [total, setTotal] = useState<number | null>(savedCents);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;

    function recompute() {
      let sum = adjustmentCents;
      for (const name of PARTS) {
        const field = form?.elements.namedItem(name);
        const raw = field instanceof HTMLInputElement ? field.value.trim() : "";
        const amount = raw === "" ? 0 : cents(raw);
        if (amount === null) {
          setTotal(null);
          return;
        }
        sum += amount;
      }
      setTotal(Math.max(0, sum));
    }

    form.addEventListener("input", recompute);
    return () => form.removeEventListener("input", recompute);
  }, [adjustmentCents]);

  return (
    <span
      ref={ref}
      className="text-[14px] font-semibold text-ink tabular-nums"
      title={total === null ? "Check the amounts above" : undefined}
    >
      {total === null ? "—" : money.format(total / 100)}
    </span>
  );
}
