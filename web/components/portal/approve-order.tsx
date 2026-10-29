"use client";

import { startTransition, useActionState, type FormEvent } from "react";

import { approveOrder } from "@/app/portal/orders/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { PhoneIcon } from "@/components/ui/icons";
import { Input, input } from "@/components/ui/input";
import { StepList } from "@/components/ui/step-list";
import { SUPPORT_PHONE } from "@/lib/brand";
import { formatPhone } from "@/lib/phone";
import type { ApproveResult } from "@/lib/portal/approval";

const MESSAGES: Record<"invalid" | "error", string> = {
  invalid: "Enter the on-site contact's name and a phone number.",
  error: `This order couldn't be approved. Refresh the page and try again, or call ${SUPPORT_PHONE.display}.`,
};

/**
 * The customer's half of checkout: confirm who the driver calls, add any
 * instructions, and approve the estimated total.
 *
 * Submitting goes through `startTransition` rather than `<form action>`: React
 * resets a form after an action, and a rejected approval must keep what the
 * customer typed. On success the page re-renders as approved and this unmounts.
 */
export function ApproveOrder({
  orderId,
  retailerLabel,
  totalLabel,
  contactName,
  contactPhone,
  instructions,
}: {
  orderId: string;
  retailerLabel: string;
  totalLabel: string;
  contactName: string;
  contactPhone: string;
  instructions: string;
}) {
  const [state, formAction, pending] = useActionState<ApproveResult, FormData>(
    approveOrder,
    { outcome: "idle" },
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const message =
    state.outcome === "invalid" || state.outcome === "error"
      ? MESSAGES[state.outcome]
      : null;

  return (
    <Card className="px-4 py-4">
      <form onSubmit={onSubmit}>
        <input type="hidden" name="orderId" value={orderId} />
        <h2 className="text-[12px] font-semibold tracking-widest text-ink-faint uppercase">
          Before you approve
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">
          The driver sees the contact and instructions.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field id="contactName" label="On-site contact">
            {(props) => (
              <Input
                {...props}
                name="contactName"
                defaultValue={contactName}
                required
                maxLength={120}
                autoComplete="name"
              />
            )}
          </Field>
          <Field id="contactPhone" label="Contact phone">
            {(props) => (
              <Input
                {...props}
                name="contactPhone"
                type="tel"
                defaultValue={formatPhone(contactPhone)}
                required
                maxLength={40}
                autoComplete="tel"
                // Formatted on leaving the field, not masked while typing.
                onBlur={(event) => {
                  event.currentTarget.value = formatPhone(
                    event.currentTarget.value,
                  );
                }}
              />
            )}
          </Field>
          <Field
            id="instructions"
            label="Delivery instructions (optional)"
            className="sm:col-span-2"
          >
            {(props) => (
              <textarea
                {...props}
                name="instructions"
                defaultValue={instructions}
                rows={3}
                maxLength={1000}
                className={input()}
              />
            )}
          </Field>
        </div>

        <div className="mt-4 border-t border-hairline-soft pt-3.5">
          <h3 className="text-[12px] font-semibold tracking-widest text-ink-faint uppercase">
            After you approve
          </h3>
          <StepList
            steps={[
              "Driver found",
              `Bought at ${retailerLabel}`,
              "Delivered",
              "You pay",
            ]}
            tone="muted"
            className="mt-2.5"
          />
        </div>

        {message ? (
          <p
            role="alert"
            className="mt-4 rounded-field bg-danger-bg px-3 py-2 text-[14px] leading-relaxed text-danger-ink"
          >
            {message}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="mt-4 w-full"
        >
          {pending ? "Approving…" : `Approve · ${totalLabel}`}
        </Button>

        <a
          href={SUPPORT_PHONE.href}
          className="mt-1 flex items-center justify-center gap-1.5 py-3 text-center text-[14px] font-medium text-accent hover:underline"
        >
          <PhoneIcon className="h-3.5 w-3.5 shrink-0" />
          Wrong item, store or address? Call {SUPPORT_PHONE.display}
        </a>
      </form>
    </Card>
  );
}
