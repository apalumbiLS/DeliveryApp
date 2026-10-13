import type { UserRole } from "@/lib/tokens";

/**
 * Where a role lands after signing in.
 *
 * Dispatchers start in the review queue, with admin users available from its
 * navigation. Drivers are sent to the portal's "no console" notice until their
 * own route exists.
 * When /driver lands, this is the one place that changes.
 */
export function homeForRole(
  role: UserRole | null | undefined,
  active: boolean | null | undefined,
) {
  if (active && role === "dispatcher") return "/dispatch/review";
  return "/portal";
}
