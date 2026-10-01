/**
 * Token contract — the TypeScript side of the design system.
 *
 * Values live in app/styles/theme.css; this file names the roles components
 * may use, so variant props stay typed and exhaustive.
 */

export const TONES = [
  "neutral",
  "info",
  "success",
  "warning",
  "danger",
] as const;

export type Tone = (typeof TONES)[number];

/**
 * Order lifecycle status → badge tone.
 * States are the domain contract (docs/architecture/04-order-lifecycle.md);
 * labels are provisional portal copy until the state machine lands.
 */
export const orderStatusTone = {
  received: "neutral",
  needs_review: "warning",
  awaiting_customer: "warning",
  customer_confirmed: "info",
  driver_requested: "info",
  driver_assigned: "info",
  driver_at_store: "info",
  items_purchased: "info",
  en_route: "info",
  delivered: "success",
  payment_requested: "warning",
  paid: "neutral",
  closed: "neutral",
  cancelled: "danger",
} as const satisfies Record<string, Tone>;

export type OrderStatus = keyof typeof orderStatusTone;

export const orderStatusLabel: Record<OrderStatus, string> = {
  received: "Received",
  needs_review: "Needs review",
  awaiting_customer: "Awaiting approval",
  customer_confirmed: "Confirmed",
  driver_requested: "Finding a driver",
  driver_assigned: "Driver assigned",
  driver_at_store: "At store",
  items_purchased: "Purchased",
  en_route: "On the way",
  delivered: "Delivered",
  payment_requested: "Payment due",
  paid: "Paid",
  closed: "Closed",
  cancelled: "Cancelled",
};

/**
 * Portal user roles — the `user_role` enum.
 *
 * "Admin" is deliberately not a role: dispatchers hold administrative
 * permissions, so the console that manages users is gated on `dispatcher`.
 * See docs/architecture/10-auth-and-permissions.md.
 */
export const USER_ROLES = ["dispatcher", "driver", "customer"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const userRoleLabel: Record<UserRole, string> = {
  dispatcher: "Dispatcher",
  driver: "Driver",
  customer: "Customer",
};

export const userRoleTone: Record<UserRole, Tone> = {
  dispatcher: "info",
  driver: "neutral",
  customer: "success",
};
