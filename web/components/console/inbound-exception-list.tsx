import Link from "next/link";

import type { InboundException } from "@/lib/dispatch/review-queue";
import { cn } from "@/lib/utils";

export function InboundExceptionList({
  entries,
  selectedId,
}: {
  entries: InboundException[];
  selectedId?: string;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="border-t border-hairline-soft">
      <h2 className="px-4 py-2 text-[10.5px] font-semibold tracking-widest text-ink-faint uppercase">
        Inbound exceptions · {entries.length}
      </h2>
      {entries.map((entry) => {
        const selected = entry.id === selectedId;
        return (
          // The same selected treatment as the review queue's rows.
          <Link
            key={entry.id}
            href={`/dispatch/review/inbound/${entry.id}`}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "block border-t border-l-3 border-t-hairline-soft px-4 py-2.5 text-[11.5px] transition-colors",
              selected
                ? "border-l-accent bg-accent-soft"
                : "border-l-transparent hover:bg-card-muted",
            )}
          >
            <span
              className={cn(
                "block",
                selected
                  ? "font-semibold text-accent-soft-ink"
                  : "font-medium text-ink",
              )}
            >
              {entry.companyName ?? "Unattributed email"}
            </span>
            <span className="mt-0.5 block truncate text-danger-ink">
              {entry.reason ?? "Awaiting processing"}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
