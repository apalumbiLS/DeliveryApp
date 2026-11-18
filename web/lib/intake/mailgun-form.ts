import type { InboundEmailInput } from "./process-inbound-email";

export const MAX_MAILGUN_BODY_BYTES = 512_000;

/** Raw MIME is larger than the parsed fields: encoded parts, every header. */
export const MAX_MAILGUN_MIME_BYTES = 1_000_000;

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

export type ParsedMailgunMimeForm =
  | {
      ok: true;
      timestamp: string | null;
      token: string | null;
      signature: string | null;
      recipient: string;
      sender: string;
      mime: Buffer;
    }
  | { ok: false; reason: string };

/**
 * What Mailgun posts to a forward URL ending in `mime`: the raw message, as a
 * text field or, in a multipart post, possibly a file part. Read as bytes, as
 * DKIM needs the message exactly as sent.
 */
export async function parseMailgunMimeForm(
  form: FormData,
): Promise<ParsedMailgunMimeForm> {
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : null;
  };
  const rawMime = form.get("body-mime");
  const mime =
    typeof rawMime === "string"
      ? Buffer.from(rawMime, "utf8")
      : rawMime
        ? Buffer.from(await rawMime.arrayBuffer())
        : null;
  if (!mime || mime.length === 0) {
    return { ok: false, reason: "Expected the raw email" };
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
    recipient,
    sender,
    mime,
  };
}

/**
 * The request's form body, read with a hard size cap so an oversized post is
 * refused before it is buffered whole. Null when it is too large or malformed.
 */
export async function readBoundedForm(
  request: Request,
  contentType: string,
  maxBytes: number,
): Promise<FormData | null> {
  if (Number(request.headers.get("content-length")) > maxBytes) return null;
  try {
    if (!request.body) return null;
    const reader = request.body.getReader();
    const chunks: Buffer[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(Buffer.from(value));
    }
    return await new Request(request.url, {
      method: "POST",
      headers: { "content-type": contentType },
      body: Buffer.concat(chunks),
    }).formData();
  } catch {
    return null;
  }
}
