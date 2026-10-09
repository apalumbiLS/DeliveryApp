/**
 * Whether the email really came from the retailer it claims to.
 *
 * The Mailgun webhook signature proves the *POST* came from Mailgun. It says
 * nothing about who sent the *email* — anyone can put `lowes@e.lowes.com` in a
 * `From` header. Without a second check, a forged cart would create an order and
 * send a driver to buy materials.
 *
 * The check here is the retailer's own DKIM signature. It is a **weak signal**,
 * and that is documented rather than hidden:
 *
 *   - A `DKIM-Signature` header can be forged by the sender; its presence is not
 *     proof. Verifying it properly means fetching the selector's public key from
 *     DNS and re-canonicalising the message, which is out of scope for the MVP.
 *   - What it does establish is that the message was prepared by something that
 *     knows the retailer's DKIM conventions, which a casual forgery will not.
 *
 * The remaining defence is that a company's order alias is not public: an
 * attacker has to know one to try at all.
 *
 * See docs/architecture/05-email-intake.md.
 */

/** Mailgun posts `message-headers` as a JSON array of `[name, value]` pairs. */
export type MessageHeader = [string, string];

export function parseMessageHeaders(raw: string | null): MessageHeader[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (entry): entry is MessageHeader =>
        Array.isArray(entry) &&
        entry.length >= 2 &&
        typeof entry[0] === "string" &&
        typeof entry[1] === "string",
    );
  } catch {
    // A malformed header blob is not worth throwing over: the caller treats an
    // empty list as "nothing verified", which is the safe direction.
    return [];
  }
}

export function headerValues(headers: MessageHeader[], name: string): string[] {
  const wanted = name.toLowerCase();
  return headers
    .filter(([headerName]) => headerName.toLowerCase() === wanted)
    .map(([, value]) => value);
}

export function firstHeader(
  headers: MessageHeader[],
  name: string,
): string | null {
  return headerValues(headers, name)[0] ?? null;
}

/**
 * The `d=` tag from every `DKIM-Signature`, lowercased.
 *
 * A message can carry several — the Lowe's sample has two, one for
 * `e.lowes.com` and one for the marketing platform that sent it on their
 * behalf — so this returns all of them rather than assuming the first.
 */
export function dkimSignedDomains(headers: MessageHeader[]): string[] {
  return headerValues(headers, "DKIM-Signature")
    .map((value) =>
      // `d` must start a tag, so `;` or the start of the header precedes it.
      // Without that anchor, `bh=` and `b=` would produce false matches.
      value.match(/(?:^|;)\s*d\s*=\s*([^;\s]+)/i)?.[1]?.toLowerCase(),
    )
    .filter((domain): domain is string => Boolean(domain));
}
