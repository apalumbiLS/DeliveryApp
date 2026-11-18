/**
 * The raw email Mailgun forwards to a `…/mime` URL, read into the fields the
 * intake pipeline already takes, plus the result of verifying its DKIM
 * signatures.
 *
 * DKIM can only be verified against the message exactly as it was sent, which
 * is why this route takes raw MIME rather than Mailgun's pre-split fields. The
 * signature check is real: it fetches the signer's public key from DNS and
 * re-hashes the headers and body. See docs/architecture/05-email-intake.md.
 */

import { dkimVerify } from "mailauth";
import { simpleParser } from "mailparser";

import type { MessageHeader } from "./authenticity";

export type MimeEmail = {
  subject: string | null;
  bodyHtml: string | null;
  bodyPlain: string | null;
  headers: MessageHeader[];
};

/** Raw header lines as `[name, value]`, unfolded, in message order. */
function headerPairs(
  lines: readonly { key: string; line: string }[],
): MessageHeader[] {
  return lines.flatMap(({ line }) => {
    const colon = line.indexOf(":");
    if (colon <= 0) return [];
    const name = line.slice(0, colon).trim();
    const value = line
      .slice(colon + 1)
      .replace(/\r?\n[ \t]+/g, " ")
      .trim();
    return [[name, value] as MessageHeader];
  });
}

export async function readMimeEmail(raw: Buffer): Promise<MimeEmail> {
  const parsed = await simpleParser(raw, { skipImageLinks: true });
  return {
    subject: parsed.subject ?? null,
    bodyHtml: typeof parsed.html === "string" ? parsed.html : null,
    bodyPlain: parsed.text ?? null,
    headers: headerPairs(parsed.headerLines),
  };
}

type Resolver = (name: string, type: string) => Promise<unknown>;

/**
 * The domains whose DKIM signature on this message verifies **and** matches
 * the domain of its From address, lowercased.
 *
 * A passing signature from an unrelated domain (a marketing platform signing
 * for itself, say) does not count: it proves who relayed the message, not who
 * wrote it. Any failure to verify, including a DNS error, yields no domains,
 * so the email falls back to dispatcher review.
 */
export async function verifiedSenderDomains(
  raw: Buffer,
  resolver?: Resolver,
): Promise<string[]> {
  try {
    const result = await dkimVerify(
      raw,
      resolver ? { resolver: resolver as never } : undefined,
    );
    return result.results.flatMap((signature) =>
      signature.status?.result === "pass" &&
      typeof signature.status.aligned === "string"
        ? [signature.status.aligned.toLowerCase()]
        : [],
    );
  } catch {
    return [];
  }
}
