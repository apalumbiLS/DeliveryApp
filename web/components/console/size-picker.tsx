import { cn } from "@/lib/utils";

/**
 * Car · Pickup · Truck — the delivery vehicle class the sizing fee is keyed to.
 *
 * The stored values are lowercase (`car`, `pickup`, `truck`); these are the
 * labels. See the `delivery_size` enum in
 * supabase/migrations/0006_order_delivery_size.sql.
 */
export const DELIVERY_SIZES = ["car", "pickup", "truck"] as const;

export type DeliverySize = (typeof DELIVERY_SIZES)[number];

export const DELIVERY_SIZE_LABELS: Record<DeliverySize, string> = {
  car: "Car",
  pickup: "Pickup",
  truck: "Truck",
};

/**
 * A segmented picker, as real radio inputs rather than spans.
 *
 * The mockups draw this as plain spans, which cannot submit. The radios are
 * visible rather than visually hidden: a `sr-only` input with no focus styling
 * would be a control a keyboard user cannot see, and getting the Tailwind
 * `peer-focus-visible` chain subtly wrong fails silently.
 *
 * Without a `name` the inputs are inert, so a mockup can still render it.
 */
export function SizePicker({
  selected,
  name,
  hint,
}: {
  selected: DeliverySize | null;
  name?: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex gap-1 rounded-control border border-hairline bg-card-muted p-1">
        {DELIVERY_SIZES.map((size) => (
          <label
            key={size}
            className={cn(
              "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-center text-[11.5px] font-medium transition-colors",
              size === selected
                ? "bg-card text-ink shadow-card"
                : "text-ink-muted hover:text-ink",
            )}
          >
            <input
              type="radio"
              name={name}
              value={size}
              defaultChecked={size === selected}
              className="h-3 w-3 accent-accent"
            />
            {DELIVERY_SIZE_LABELS[size]}
          </label>
        ))}
      </div>
      {hint ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
