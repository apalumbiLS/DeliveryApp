import { describe, expect, test } from "bun:test";

import { formatPhone } from "./phone";

describe("formatPhone", () => {
  test("formats a 10-digit number however it was typed", () => {
    expect(formatPhone("8645550147")).toBe("(864) 555-0147");
    expect(formatPhone("864-555-0147")).toBe("(864) 555-0147");
    expect(formatPhone("864.555.0147")).toBe("(864) 555-0147");
    expect(formatPhone(" (864) 555 0147 ")).toBe("(864) 555-0147");
  });

  test("drops a leading US country code", () => {
    expect(formatPhone("+1 864 555 0147")).toBe("(864) 555-0147");
    expect(formatPhone("18645550147")).toBe("(864) 555-0147");
  });

  test("leaves anything it doesn't recognise as typed", () => {
    expect(formatPhone("864-555-0147 ext 12")).toBe("864-555-0147 ext 12");
    expect(formatPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
    expect(formatPhone("555-0147")).toBe("555-0147");
    expect(formatPhone("")).toBe("");
  });
});
