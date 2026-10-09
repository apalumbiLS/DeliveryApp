/**
 * Read a committed `.eml` fixture into the shape a parser actually receives.
 *
 * Production never does this. Mailgun decodes MIME at its edge and hands the
 * webhook already-separated fields, so none of this ships. It exists so a test
 * parses the **real artifact** — headers, transfer encoding, folding, and all —
 * rather than a hand-copied HTML file that could silently drift from it.
 *
 * Both header quirks below are real, not hypothetical: Lowe's folds the `From`
 * line so the address sits on a continuation line, and encodes the display name
 * as an RFC 2047 base64 word.
 *
 * Imported only by tests.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type EmlFixture = {
  bodyHtml: string;
  subject: string | null;
  senderEmail: string;
  /**
   * Every header as a `[name, value]` pair, unfolded and decoded — the same
   * shape Mailgun posts as `message-headers`.
   */
  headers: [string, string][];
};

/** `=?charset?B?base64?=` or `=?charset?Q?quoted-printable?=`. */
const ENCODED_WORD = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;

function charsetIsUtf8(charset: string): boolean {
  return /^utf-?8$/i.test(charset);
}

/**
 * RFC 2047 encoded-words. Lowe's encodes the display name, and the address sits
 * after it — so decoding is what makes the address findable at all.
 */
function decodeEncodedWords(value: string): string {
  return value.replace(
    ENCODED_WORD,
    (whole, charset: string, encoding: string, payload: string) => {
      const utf8 = charsetIsUtf8(charset);
      try {
        if (encoding.toUpperCase() === "B") {
          return Buffer.from(payload, "base64").toString(utf8 ? "utf8" : "latin1");
        }

        // Q-encoding: `_` is a space, `=XX` is a byte, everything else literal.
        const spaced = payload.replace(/_/g, " ");
        const bytes: number[] = [];

        for (let index = 0; index < spaced.length; index += 1) {
          const char = spaced[index];
          const escape = spaced.slice(index + 1, index + 3);

          if (char === "=" && /^[0-9A-Fa-f]{2}$/.test(escape)) {
            bytes.push(Number.parseInt(escape, 16));
            index += 2;
          } else {
            bytes.push(char.charCodeAt(0) & 0xff);
          }
        }

        return Buffer.from(bytes).toString(utf8 ? "utf8" : "latin1");
      } catch {
        // A malformed word is not worth failing a fixture read over.
        return whole;
      }
    },
  );
}

/**
 * RFC 5322 header folding: a line beginning with whitespace continues the one
 * before it. Without this, a folded `From` yields only its first line.
 */
function unfoldHeaders(block: string): string {
  const unfolded: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (/^[ \t]/.test(line) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += ` ${line.trim()}`;
    } else {
      unfolded.push(line);
    }
  }

  return unfolded.join("\n");
}

/**
 * RFC 2045 quoted-printable: `=XX` is a hex byte, and `=` at end of line is a
 * soft break. Bytes are collected first and decoded as UTF-8 together, so a
 * multi-byte character split across escapes survives.
 *
 * Note this is often a no-op in practice — the Lowe's sample declares
 * `quoted-printable` but escapes nothing, leaving every `=` literal. It is here
 * for the fixture that does.
 */
function decodeQuotedPrintable(input: string): string {
  const withoutSoftBreaks = input.replace(/=\r?\n/g, "");
  const bytes: number[] = [];

  for (let index = 0; index < withoutSoftBreaks.length; index += 1) {
    const char = withoutSoftBreaks[index];
    const escape = withoutSoftBreaks.slice(index + 1, index + 3);

    if (char === "=" && /^[0-9A-Fa-f]{2}$/.test(escape)) {
      bytes.push(Number.parseInt(escape, 16));
      index += 2;
      continue;
    }

    const code = char.charCodeAt(0);
    if (code > 127) {
      bytes.push(...Buffer.from(char, "utf8"));
    } else {
      bytes.push(code);
    }
  }

  return Buffer.from(bytes).toString("utf8");
}

export function readEmlFixture(relativePath: string): EmlFixture {
  const raw = readFileSync(join(import.meta.dir, relativePath), "utf8");

  // Headers and body are separated by the first blank line, CRLF or LF.
  const crlf = raw.indexOf("\r\n\r\n");
  const lf = raw.indexOf("\n\n");
  const isCrlf = crlf !== -1 && (lf === -1 || crlf < lf);
  const separator = isCrlf ? crlf : lf;

  if (separator === -1) {
    throw new Error(`no header/body separator in ${relativePath}`);
  }

  const headers = unfoldHeaders(raw.slice(0, separator));
  const body = raw.slice(separator + (isCrlf ? 4 : 2));

  const headerPairs: [string, string][] = [];
  for (const line of headers.split("\n")) {
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    headerPairs.push([
      line.slice(0, colon),
      decodeEncodedWords(line.slice(colon + 1)).trim(),
    ]);
  }

  const header = (name: string): string | null => {
    // `[ \t]*` rather than `\s*`: the latter would eat a newline and capture
    // the following line when a header has an empty value.
    const match = headers.match(new RegExp(`^${name}:[ \\t]*(.*)$`, "mi"));
    if (!match) return null;
    const value = decodeEncodedWords(match[1]).trim();
    return value.length > 0 ? value : null;
  };

  const encoding = header("Content-Transfer-Encoding")?.toLowerCase() ?? "7bit";
  const bodyHtml =
    encoding === "quoted-printable" ? decodeQuotedPrintable(body) : body;

  // `From` is a display name plus an angle-addr, e.g.
  // `Lowe's Home Improvement <lowes@e.lowes.com>`.
  const from = header("From") ?? "";

  return {
    bodyHtml,
    subject: header("Subject"),
    senderEmail:
      from.match(/<([^>]+)>/)?.[1] ?? from.match(/([^\s]+@[^\s]+)/)?.[1] ?? "",
    headers: headerPairs,
  };
}
