import { describe, expect, test } from "bun:test";

import { isParsedMailgunContentType, parseMailgunForm } from "./mailgun-form";

function form() {
  const data = new FormData();
  data.set("recipient", "things.dispatch+acme@orders.example.com");
  data.set("sender", "bounce@e.lowes.com");
  data.set("subject", "Shared cart");
  data.set("body-html", "<html>cart</html>");
  data.set("timestamp", "1800000000");
  data.set("token", "test-token");
  data.set("signature", "test-signature");
  return data;
}

describe("Mailgun forward form", () => {
  test("accepts parsed form types, not JSON or raw MIME", () => {
    expect(
      isParsedMailgunContentType("application/x-www-form-urlencoded"),
    ).toBe(true);
    expect(
      isParsedMailgunContentType("multipart/form-data; boundary=abc"),
    ).toBe(true);
    expect(isParsedMailgunContentType("application/json")).toBe(false);
    expect(isParsedMailgunContentType("application/mime")).toBe(false);
  });

  test("keeps the SMTP envelope recipient separate from the sender", () => {
    const parsed = parseMailgunForm(form());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.email.recipient).toBe(
      "things.dispatch+acme@orders.example.com",
    );
    expect(parsed.email.sender).toBe("bounce@e.lowes.com");
    expect(parsed.email.bodyHtml).toBe("<html>cart</html>");
  });

  test("rejects storage notifications or messages without HTML", () => {
    const stored = new FormData();
    stored.set("message-url", "https://example.com/raw");
    expect(parseMailgunForm(stored).ok).toBe(false);
    const missing = form();
    missing.delete("body-html");
    expect(parseMailgunForm(missing).ok).toBe(false);
  });

  test("rejects multiple HTML parts instead of silently picking one", () => {
    const repeated = form();
    repeated.append("body-html", "<html>different</html>");
    expect(parseMailgunForm(repeated).ok).toBe(false);
  });
});
