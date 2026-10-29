/**
 * Whether an order may be sent to the customer for approval.
 *
 * Pure and separate from the action so it can be tested without a database or a
 * Next runtime. It is also the real guard: the button's `disabled` state is a
 * UI affordance, and a server action can be invoked directly.
 *
 * Sending moves the order to `awaiting_customer`, where the customer approves
 * it in the portal. The checkout email is a later, extra trigger on the same
 * step, which is why no customer email address is required here.
 *
 * See transitions 3 and 4 in docs/architecture/04-order-lifecycle.md.
 */

import type { Gate } from "./gates";
import { blockingGate } from "./gates";

/** The statuses an order can be sent from — the review queue's. */
const SENDABLE_STATUSES = ["received", "needs_review"];

export type SendDecision = { ok: true } | { ok: false; reason: string };

export function canSendForApproval(input: {
  status: string;
  gates: Gate[];
}): SendDecision {
  const blocker = blockingGate(input.gates);
  if (blocker) {
    return {
      ok: false,
      reason: `${blocker.label.toLowerCase()} is unresolved`,
    };
  }

  // Anything else means it was already sent, or has moved well beyond it.
  // Orders an earlier prototype marked as invited are `awaiting_customer`, so
  // this also keeps them from being sent twice.
  if (!SENDABLE_STATUSES.includes(input.status)) {
    return { ok: false, reason: `the order is already ${input.status}` };
  }

  return { ok: true };
}
