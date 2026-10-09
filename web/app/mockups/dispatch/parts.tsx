import type { ReactNode } from "react";

import { ConsoleShell as SharedConsoleShell } from "@/components/console/console-shell";
import {
  SizePicker as SharedSizePicker,
  type DeliverySize,
} from "@/components/console/size-picker";
import { cn } from "@/lib/utils";

import { DISPATCHER, NAV } from "./data";

/**
 * The console primitives live in `components/console/` so these mockups and the
 * real dispatcher console cannot drift apart — they are literally the same
 * components.
 *
 * What stays here is only what is mockup-specific: a `ConsoleShell` that
 * supplies the demo dispatcher and a static nav, and a `SizePicker` that accepts
 * the demo data's capitalised labels.
 *
 * See docs/architecture/06-cart-parsing.md.
 */

export { Band } from "@/components/console/band";
export { Panel } from "@/components/console/panel";
export { Field } from "@/components/console/field";
export { Row } from "@/components/console/row";
export { PriceLine } from "@/components/console/price-line";
export {
  CheckDot,
  CheckRow,
  type CheckState,
} from "@/components/console/check-row";
export { Th, Td } from "@/components/console/table";

/** The demo data says "Pickup"; the real enum says `pickup`. */
export function SizePicker({
  selected,
  hint,
}: {
  selected: string;
  hint?: string;
}) {
  return (
    <SharedSizePicker
      selected={selected.toLowerCase() as DeliverySize}
      hint={hint}
    />
  );
}

export function ConsoleShell({
  title,
  note,
  active,
  actions,
  children,
}: {
  title: string;
  note?: string;
  active: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SharedConsoleShell
      title={title}
      note={note}
      actions={actions}
      user={{
        name: DISPATCHER.name,
        initials: DISPATCHER.initials,
        role: "Dispatcher",
      }}
      nav={
        <nav className="space-y-0.5">
          {NAV.map((item) => (
            <div
              key={item.label}
              className={cn(
                "flex items-center justify-between rounded-control px-2.5 py-2 text-[12.5px]",
                item.label === active
                  ? "bg-card font-medium text-ink shadow-card"
                  : "text-ink-muted",
              )}
            >
              <span>{item.label}</span>
              {item.badge ? (
                <span className="text-[11px] text-ink-faint tabular-nums">
                  {item.badge}
                </span>
              ) : null}
            </div>
          ))}
        </nav>
      }
    >
      {children}
    </SharedConsoleShell>
  );
}
