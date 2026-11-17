/**
 * What the driver is paid for a job.
 *
 * The 90% share is a placeholder until payout is configured deliberately
 * (`docs/backlog.md`). The database applies the same rule when a job posts
 * without a saved payout — `default_driver_payout_cents` in
 * `supabase/migrations/0013_driver_jobs.sql` — so change both together.
 */
export const DEFAULT_DRIVER_PAYOUT_SHARE = 0.9;

export function defaultDriverPayoutCents(
  sizingCents: number,
  mileageCents: number,
): number {
  return Math.round((sizingCents + mileageCents) * DEFAULT_DRIVER_PAYOUT_SHARE);
}

/** Statuses in which the dispatcher may still change the payout. */
const PAYOUT_OPEN_STATUSES = [
  "received",
  "needs_review",
  "awaiting_customer",
  "customer_confirmed",
  "driver_requested",
];

/** Locked once a driver accepts, so the driver is paid what they saw. */
export function isPayoutLocked(status: string): boolean {
  return !PAYOUT_OPEN_STATUSES.includes(status);
}
