import type { UserRole } from "@/lib/tokens";

/**
 * Where a role lands after signing in.
 *
 * Only the customer portal and the admin console exist, so a driver is sent to
 * the portal and shown the "no console" notice rather than to a dead route.
 * When /driver lands, this is the one place that changes.
 */
export function homeForRole(
  role: UserRole | null | undefined,
  active: boolean | null | undefined,
) {
  if (active && role === "dispatcher") return "/admin";
  return "/portal";
}
