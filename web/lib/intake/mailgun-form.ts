import type { InboundEmailInput } from "./process-inbound-email";

export const MAX_MAILGUN_BODY_BYTES = 512_000;

export type ParsedMailgunForm =
  | {
      ok: true;
      timestamp: string | null;
      token: string | null;
      signature: string | null;
      email: InboundEmailInput;
    }
  | { ok: false; reason: string };

export function isParsedMailgunContentType(value: string | null): boolean {
  if (!value) return false;
  return (
    /^application\/x-www-form-urlencoded(?:;|$)/i.test(value) ||
    /^multipart\/form-data\s*;/i.test(value)
  );
}

export function parseMailgunForm(form: FormData): ParsedMailgunForm {
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : null;
  };
  const htmlParts = form.getAll("body-html");
  if (
    htmlParts.length !== 1 ||
    typeof htmlParts[0] !== "string" ||
    !htmlParts[0].trim()
  ) {
    return { ok: false, reason: "Expected one HTML email part" };
  }

  const recipient = field("recipient");
  const sender = field("sender");
  if (!recipient || !sender) {
    return { ok: false, reason: "Missing SMTP sender or recipient" };
  }

  return {
    ok: true,
    timestamp: field("timestamp"),
    token: field("token"),
    signature: field("signature"),
    email: {
      recipient,
      sender,
      subject: field("subject"),
      bodyHtml: htmlParts[0],
      bodyPlain: field("body-plain"),
      strippedHtml: field("stripped-html"),
      messageHeadersRaw: field("message-headers"),
    },
  };
}
