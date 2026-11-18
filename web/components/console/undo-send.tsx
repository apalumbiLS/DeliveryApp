"use client";

import { SubmitButton } from "@/components/ui/submit-button";
import { undoSendForApproval } from "@/lib/dispatch/actions";

/**
 * Takes back a send for approval, before the customer approves. Confirmed
 * first, since the customer may already be looking at it.
 */
export function UndoSend({ orderId }: { orderId: string }) {
  return (
    <form
      action={undoSendForApproval}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Take this order back from the customer and return it to review? They won't be able to approve it until you send it again.",
          )
        ) {
          event.preventDefault();
        }
      }}
      className="shrink-0"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <SubmitButton intent="secondary" size="sm" pendingLabel="Undoing…">
        Undo send
      </SubmitButton>
    </form>
  );
}
