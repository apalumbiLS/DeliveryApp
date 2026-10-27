import { TruckIcon } from "@/components/ui/icons";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** A beat after load before the truck pulls in, so the page settles first. */
const DRIVE_IN_DELAY_MS = 300;

/** Staggered so the exhaust trails the truck, with a last puff as it settles. */
const SMOKE_DELAYS_MS = [0, 120, 240, 520];

/** Smoke sits at the truck's rear axle, so it moves with the icon size. */
const SIZES = {
  md: {
    gap: "gap-2.5",
    tile: "h-9 w-9",
    truck: "h-5 w-5",
    smoke: "top-5 left-1.5 size-1.5",
    name: "text-[15px]",
  },
  lg: {
    gap: "gap-3",
    tile: "h-12 w-12",
    truck: "h-7 w-7",
    smoke: "top-6.5 left-2 size-2",
    name: "text-[20px]",
  },
};

/**
 * The accent tile and product name, as it appears above every public screen.
 * `animated` drives the truck into the tile once on load, trailing smoke.
 */
export function BrandLockup({
  className,
  animated = false,
  size = "md",
}: {
  className?: string;
  animated?: boolean;
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  return (
    <div className={cn("flex items-center", s.gap, className)}>
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-control bg-accent text-accent-ink",
          s.tile,
        )}
      >
        {animated ? (
          <span
            className="absolute inset-0 flex items-center justify-center motion-safe:animate-truck-drive-in"
            style={{ animationDelay: `${DRIVE_IN_DELAY_MS}ms` }}
          >
            {SMOKE_DELAYS_MS.map((delay) => (
              <span
                key={delay}
                aria-hidden
                className={cn(
                  "absolute rounded-full bg-accent-ink/60 opacity-0 motion-safe:animate-smoke-puff",
                  s.smoke,
                )}
                style={{ animationDelay: `${DRIVE_IN_DELAY_MS + delay}ms` }}
              />
            ))}
            <TruckIcon className={s.truck} />
          </span>
        ) : (
          <TruckIcon className={s.truck} />
        )}
      </div>
      <span className={cn("font-semibold text-ink", s.name)}>{APP_NAME}</span>
    </div>
  );
}
