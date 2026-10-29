import { describe, expect, test } from "bun:test";

import { parseApproval } from "./approval";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("parseApproval", () => {
  test("accepts a contact and trims it, with instructions optional", () => {
    expect(
      parseApproval(
        form({
          contactName: "  Dave ",
          contactPhone: "(864) 555-0147",
          instructions: "  ",
        }),
      ),
    ).toEqual({
      ok: true,
      value: {
        contactName: "Dave",
        contactPhone: "(864) 555-0147",
        instructions: null,
      },
    });
  });

  test("keeps instructions when given", () => {
    const result = parseApproval(
      form({
        contactName: "Dave",
        contactPhone: "864-555-0147",
        instructions: "Gate code 4412",
      }),
    );
    expect(result.ok && result.value.instructions).toBe("Gate code 4412");
  });

  test("refuses a missing name or a phone without enough digits", () => {
    expect(
      parseApproval(form({ contactName: "", contactPhone: "864-555-0147" })),
    ).toEqual({ ok: false });
    expect(
      parseApproval(form({ contactName: "Dave", contactPhone: "call me" })),
    ).toEqual({ ok: false });
  });

  test("refuses instructions past the database's limit", () => {
    expect(
      parseApproval(
        form({
          contactName: "Dave",
          contactPhone: "864-555-0147",
          instructions: "x".repeat(1001),
        }),
      ),
    ).toEqual({ ok: false });
  });
});
