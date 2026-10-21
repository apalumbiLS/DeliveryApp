import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Shown the moment a portal link is clicked, inside the portal's chrome, while
 * the next page renders on the server. Every portal page reads from Supabase,
 * so without this the click appears to do nothing until the data arrives.
 *
 * A generic page shape — a title and a few rows — rather than a copy of any one
 * page, since it stands in for all of them.
 */
export default function PortalLoading() {
  return (
    <div role="status" aria-label="Loading">
      <div className="space-y-2">
        <Bar className="h-5 w-32" />
        <Bar className="h-3.5 w-64 max-w-full" />
      </div>

      <Card className="mt-5 divide-y divide-hairline-soft">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-3 px-4 py-3.5">
            <Bar className="size-2 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Bar className="h-3.5 w-28" />
              <Bar className="h-3 w-44 max-w-full" />
            </div>
            <Bar className="h-3.5 w-14" />
          </div>
        ))}
      </Card>
    </div>
  );
}

function Bar({ className }: { className: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-control bg-sunken motion-reduce:animate-none",
        className,
      )}
    />
  );
}
