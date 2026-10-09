import { describe, expect, test } from "bun:test";

import { readEmlFixture } from "@/lib/parsers/__fixtures__/read-eml";

import {
  dkimSignedDomains,
  firstHeader,
  parseMessageHeaders,
} from "./authenticity";

const fixture = readEmlFixture("lowes/multi-item.eml");
const realHeaders = parseMessageHeaders(JSON.stringify(fixture.headers));

describe("parseMessageHeaders", () => {
  test("reads Mailgun's JSON array of pairs", () => {
    expect(parseMessageHeaders('[["Subject","hi"],["From","a@b.c"]]')).toEqual([
      ["Subject", "hi"],
      ["From", "a@b.c"],
    ]);
  });

  test("returns an empty list rather than throwing on malformed input", () => {
    // An empty list means "nothing verified", which is the safe direction.
    for (const bad of [null, "", "not json", '{"a":1}', '[["only-one"]]', "[]"]) {
      expect(parseMessageHeaders(bad)).toEqual([]);
    }
  });
});

describe("dkimSignedDomains", () => {
  test("finds every signature on a real Lowe's email", () => {
    // Lowe's signs with its own domain, and the marketing platform that sent it
    // on their behalf signs with theirs. Both are present.
    const domains = dkimSignedDomains(realHeaders);
    expect(domains).toContain("e.lowes.com");
    expect(domains).toContain("s4.y.mc.salesforce.com");
  });

  test("does not mistake other tags for the d= tag", () => {
    // `bh=` and `b=` both contain a `b`, and a naive `d=` search over the whole
    // header would eventually find a false one. `d` must start a tag.
    expect(
      dkimSignedDomains([
        ["DKIM-Signature", "v=1; a=rsa-sha256; bh=abc; b=xyz; s=selector"],
      ]),
    ).toEqual([]);
  });

  test("finds d= wherever it sits in the tag list", () => {
    expect(
      dkimSignedDomains([["DKIM-Signature", "v=1; d=example.com; s=sel"]]),
    ).toEqual(["example.com"]);
    expect(
      dkimSignedDomains([["DKIM-Signature", "v=1; s=sel; d=example.com"]]),
    ).toEqual(["example.com"]);
  });

  test("lowercases the domain, since DKIM tags are case-insensitive", () => {
    expect(
      dkimSignedDomains([["DKIM-Signature", "v=1; d=Example.COM; s=sel"]]),
    ).toEqual(["example.com"]);
  });
});

describe("firstHeader", () => {
  test("finds the real Message-ID, which is the idempotency key", () => {
    // Mailgun's forward payload carries no message id of its own, so this
    // header is what makes a redelivery recognisable.
    const messageId = firstHeader(realHeaders, "Message-ID");
    expect(messageId).toBe(
      "<563d0205-2c45-480e-8b86-6b1520139fe3@las1s04mta0227.xt.local>",
    );
  });

  test("matches header names case-insensitively", () => {
    const headers = parseMessageHeaders('[["MESSAGE-ID","<x@y>"]]');
    expect(firstHeader(headers, "Message-ID")).toBe("<x@y>");
  });

  test("returns null when the header is absent", () => {
    expect(firstHeader(realHeaders, "X-Not-A-Header")).toBeNull();
  });
});
