/**
 * The driver's four status steps, in order (docs/runbooks/driver-guide.md).
 * Forward only: a wrong tap is a call to the dispatcher, not an undo.
 */

export type DriverStatus =
  | "driver_assigned"
  | "driver_at_store"
  | "items_purchased"
  | "en_route"
  | "delivered";

export type JobStep = {
  /** The status the step moves the job to. */
  to: Exclude<DriverStatus, "driver_assigned">;
  /** The button. */
  label: string;
  /** What the driver does before tapping it. */
  hint: string;
  /** The photo the step asks for; skipping it takes a reason. */
  photo: "receipt" | "delivery" | null;
};

export const JOB_STEPS: readonly JobStep[] = [
  {
    to: "driver_at_store",
    label: "I'm at the store",
    hint: "Tap when you arrive at the store.",
    photo: null,
  },
  {
    to: "items_purchased",
    label: "Items purchased",
    hint: "After you buy and load everything, photograph the receipt.",
    photo: "receipt",
  },
  {
    to: "en_route",
    label: "On my way",
    hint: "Tap when you leave the store for the site.",
    photo: null,
  },
  {
    to: "delivered",
    label: "Delivered",
    hint: "Photograph the materials where you left them.",
    photo: "delivery",
  },
];

const ORDER: readonly DriverStatus[] = [
  "driver_assigned",
  "driver_at_store",
  "items_purchased",
  "en_route",
  "delivered",
];

export function isDriverStatus(status: string): status is DriverStatus {
  return (ORDER as readonly string[]).includes(status);
}

/** The step to take next, or null once delivered. */
export function nextStep(status: DriverStatus): JobStep | null {
  return JOB_STEPS[ORDER.indexOf(status)] ?? null;
}

/** Whether the job has reached `status` yet. */
export function hasReached(current: DriverStatus, status: DriverStatus) {
  return ORDER.indexOf(current) >= ORDER.indexOf(status);
}

export function isStepTarget(value: string): value is JobStep["to"] {
  return JOB_STEPS.some((step) => step.to === value);
}

export type StepEvent = {
  from_status: string | null;
  to_status: string;
  created_at: string;
};

/**
 * When the job was last posted and reached each driver step, from its status
 * events in time order. Releasing a job from its driver posts it again and
 * starts the steps over, so only the current run's times are kept.
 */
export function stepTimes(events: readonly StepEvent[]): {
  postedAt: string | null;
  reachedAt: Partial<Record<DriverStatus, string>>;
  releasedAt: string | null;
} {
  let postedAt: string | null = null;
  let releasedAt: string | null = null;
  let reachedAt: Partial<Record<DriverStatus, string>> = {};

  for (const event of events) {
    if (event.to_status === "driver_requested") {
      postedAt = event.created_at;
      reachedAt = {};
      if (event.from_status !== null && isDriverStatus(event.from_status)) {
        releasedAt = event.created_at;
      }
    } else if (isDriverStatus(event.to_status)) {
      reachedAt[event.to_status] = event.created_at;
    }
  }

  return { postedAt, reachedAt, releasedAt };
}
