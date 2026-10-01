import { APP_MARK, APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** The accent tile and product name, as it appears above every public screen. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-accent text-[13px] font-semibold text-accent-ink">
        {APP_MARK}
      </div>
      <span className="text-[15px] font-semibold text-ink">{APP_NAME}</span>
    </div>
  );
}
