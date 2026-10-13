import { describe, expect, test } from "bun:test";

import { companyOrderAddress, isInboundAddressReady } from "./config";

const ready = {
  domain: "inbound.prototype.example",
  signingKey: "test-signing-key",
  ready: "true",
};
const companyAlias = "things.dispatch+acme-construction";

describe("customer-facing inbound address", () => {
  test("keeps the company's plus-tag local part", () => {
    const address = companyOrderAddress(companyAlias, ready);
    expect(address).toBe(
      "things.dispatch+acme-construction@inbound.prototype.example",
    );
  });

  test("stays hidden until receiving is confirmed", () => {
    expect(isInboundAddressReady({ ...ready, ready: undefined })).toBe(false);
    const unconfirmed = { ...ready, ready: "false" };
    expect(companyOrderAddress(companyAlias, unconfirmed)).toBeNull();
  });

  test("requires the signing key and a non-Gmail domain", () => {
    expect(isInboundAddressReady({ ...ready, signingKey: " " })).toBe(false);
    for (const domain of ["gmail.com", "googlemail.com", "no-domain"]) {
      expect(isInboundAddressReady({ ...ready, domain })).toBe(false);
    }
  });

  test("rejects missing or invalid company aliases", () => {
    expect(companyOrderAddress(null, ready)).toBeNull();
    expect(companyOrderAddress("bad@other-domain", ready)).toBeNull();
    expect(companyOrderAddress("a".repeat(65), ready)).toBeNull();
  });
});
