import Link from "next/link";

import type { InboundException } from "@/lib/dispatch/review-queue";

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
      {entries.map((entry) => (
        <Link
          key={entry.id}
          href={`/dispatch/review/inbound/${entry.id}`}
          aria-current={entry.id === selectedId ? "page" : undefined}
          className="block border-t border-hairline-soft px-4 py-2.5 text-[11.5px] hover:bg-card-muted"
        >
          <span className="block font-medium text-ink">
            {entry.companyName ?? "Unattributed email"}
          </span>
          <span className="mt-0.5 block truncate text-danger-ink">
            {entry.reason ?? "Awaiting processing"}
          </span>
        </Link>
      ))}
    </div>
  );
}
