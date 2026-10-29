/**
 * The customer's approval form: what it may change, and what it reports back.
 *
 * Pure, so the limits can be tested without a database. They match the
 * dispatcher's delivery form and the `approve_order` function, which holds
 * them again — a server action can be invoked directly.
 */

import { formatPhone } from "@/lib/phone";

/** What an approval tells the form that sent it. `idle` is before any try. */
export type ApproveResult = {
  outcome: "idle" | "approved" | "invalid" | "error";
};

export type ApprovalInput = {
  contactName: string;
  contactPhone: string;
  instructions: string | null;
};

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** The on-site contact and delivery instructions — the only fields a customer edits. */
export function parseApproval(
  form: FormData,
): { ok: true; value: ApprovalInput } | { ok: false } {
  const contactName = text(form, "contactName");
  const contactPhone = text(form, "contactPhone");
  const instructions = text(form, "instructions");
  const digits = contactPhone.replace(/\D/g, "");

  if (
    !contactName ||
    contactName.length > 120 ||
    contactPhone.length < 7 ||
    contactPhone.length > 40 ||
    digits.length < 7 ||
    digits.length > 15 ||
    instructions.length > 1000
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      contactName,
      // Stored formatted, so the driver sees one style whether or not the
      // form's on-blur formatting ran.
      contactPhone: formatPhone(contactPhone),
      instructions: instructions || null,
    },
  };
}
