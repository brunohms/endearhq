import { describe, expect, it } from "vitest";
import { validateIngestPayload } from "../src/ingest.js";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("validateIngestPayload", () => {
  it("accepts a customer payload and keeps its extra fields", () => {
    const result = validateIngestPayload({
      type: "customer",
      id: UUID,
      first_name: "Ada",
      last_name: "Lovelace",
      whatever: { nested: true },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.type).toBe("customer");
    expect(result.value.whatever).toEqual({ nested: true });
  });

  it("accepts an order payload", () => {
    const result = validateIngestPayload({ type: "order", id: UUID, value: 12.5 });
    expect(result.ok).toBe(true);
  });

  it.each([
    ["a missing type", { id: UUID }],
    ["an unknown type", { type: "invoice", id: UUID }],
    ["a non-string type", { type: 7, id: UUID }],
  ])("rejects %s", (_label, body) => {
    const result = validateIngestPayload(body);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("type");
  });

  it.each([
    ["a missing id", { type: "order" }],
    ["an id that is not a uuid", { type: "order", id: "12345" }],
  ])("rejects %s", (_label, body) => {
    const result = validateIngestPayload(body);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("id");
  });

  it.each([
    ["null", null],
    ["an array", [{ type: "order", id: UUID }]],
    ["a string", "order"],
  ])("rejects %s as the body", (_label, body) => {
    const result = validateIngestPayload(body);
    expect(result.ok).toBe(false);
  });
});
