import type { UserRole } from "@/lib/tokens";

/**
 * Where a role lands after signing in.
 *
 * Dispatchers start in the review queue, with admin users available from its
 * navigation. Drivers start on their jobs.
 */
export function homeForRole(
  role: UserRole | null | undefined,
  active: boolean | null | undefined,
) {
  if (active && role === "dispatcher") return "/dispatch/review";
  if (active && role === "driver") return "/driver";
  return "/portal";
}
