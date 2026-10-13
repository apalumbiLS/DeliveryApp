/**
 * Whether a checkout invite may be queued for an order.
 *
 * Pure and separate from the action so it can be tested without a database or a
 * Next runtime. It is also the real guard: the button's `disabled` state is a
 * UI affordance, and a server action can be invoked directly.
 *
 * See docs/architecture/06-cart-parsing.md and the trigger matrix in
 * docs/architecture/08-notifications.md.
 */

import type { Gate } from "./gates";
import { blockingGate } from "./gates";

export const CHECKOUT_INVITES_ENABLED = false;

/** The statuses an order can be invited from. */
const INVITABLE_STATUSES = ["received", "needs_review"];

export type InviteDecision = { ok: true } | { ok: false; reason: string };

export function canQueueInvite(input: {
  status: string;
  gates: Gate[];
  inviteRecipient: string | null;
  inviteQueued: boolean;
}): InviteDecision {
  // Checked first: a second click should be a quiet no-op, not a second row.
  // The unique `dedupe_key` backs this up, but saying so here is what makes the
  // intent legible.
  if (input.inviteQueued) {
    return { ok: false, reason: "an invite is already queued" };
  }

  const blocker = blockingGate(input.gates);
  if (blocker) {
    return { ok: false, reason: `${blocker.label.toLowerCase()} is unresolved` };
  }

  if (!input.inviteRecipient) {
    return { ok: false, reason: "there is no address to invite" };
  }

  // Anything past `awaiting_customer` means the invite either already went out
  // or the order has moved well beyond it.
  if (!INVITABLE_STATUSES.includes(input.status)) {
    return { ok: false, reason: `the order is already ${input.status}` };
  }

  return { ok: true };
}
