/**
 * Preparing a retailer's email to be shown to a dispatcher.
 *
 * The body is **untrusted third-party HTML**. Nothing else in the product
 * renders HTML it did not author, so this is the one place that has to.
 *
 * Four independent layers, and they are deliberately redundant:
 *
 *   1. It is served from its own route, not inline — so the email's ~30 KB is
 *      not in our document, and real HTTP headers can be set on it.
 *   2. The response carries a Content-Security-Policy locked to `default-src
 *      'none'` with a narrow image allowlist. Inline styles survive, because the
 *      retailer's layout is the whole reason for showing the email; everything
 *      else — fonts, frames, scripts, tracking pixels — is refused.
 *   3. `X-Content-Type-Options: nosniff`.
 *   4. It is embedded in `<iframe sandbox="">`, which is the strongest of the
 *      four: no scripts, no forms, no navigation, opaque origin.
 *
 * The sanitizer below is the innermost layer. It is redundant given the other
 * three, which is the point — it is the one that holds if a header is ever
 * misconfigured.
 */

import sanitizeHtml from "sanitize-html";

/**
 * The hosts a product image may come from.
 *
 * `image.e.lowes.com` is in the list because it serves the retailer's own
 * chrome; `mobileimages.lowes.com` is where the product photos live. Every other
 * host is refused, which is what stops a tracking pixel firing when a dispatcher
 * opens an order.
 */
export const ALLOWED_IMAGE_HOSTS = [
  "https://mobileimages.lowes.com",
  "https://image.e.lowes.com",
];

export const EMAIL_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  // The retailer's layout is inline styles; without this the email is unreadable
  // and the panel has no reason to exist.
  "style-src 'unsafe-inline'",
  `img-src ${ALLOWED_IMAGE_HOSTS.join(" ")}`,
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const ALLOWED_TAGS = [
  "html",
  "head",
  "body",
  "style",
  "title",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "caption",
  "colgroup",
  "col",
  "div",
  "span",
  "p",
  "a",
  "img",
  "br",
  "hr",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "small",
  "font",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "center",
];

const LAYOUT_ATTRIBUTES = [
  "style",
  "class",
  "align",
  "valign",
  "width",
  "height",
  "bgcolor",
  "border",
  "cellpadding",
  "cellspacing",
  "colspan",
  "rowspan",
  "dir",
  "lang",
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    "*": LAYOUT_ATTRIBUTES,
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height", "border", "style"],
  },
  // `data:` is excluded: an inline base64 image would bloat every page load, and
  // the product photos are remote.
  allowedSchemes: ["https", "http", "mailto"],
  allowProtocolRelative: false,
  // Drop a disallowed tag but keep its text, so stripping one element does not
  // blank out a line of the cart.
  disallowedTagsMode: "discard",
  parser: { lowerCaseTags: true },
};

/**
 * `script`, `iframe`, `object`, `embed`, `form`, `input`, `button`, `link`, and
 * `meta` are all absent from `ALLOWED_TAGS` — the last two because a
 * `<meta http-equiv="refresh">` is a redirect and a `<link rel="stylesheet">`
 * is a remote fetch.
 */
export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}
