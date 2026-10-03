import { describe, expect, it } from "vitest";
import { mapPayload, parseMessage } from "../src/mapping.js";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const CUSTOMER_UUID = "9c858901-8a57-4791-81fe-4c455b099bc9";

describe("mapPayload", () => {
  it("maps a customer and keeps the whole payload in data", () => {
    const payload = {
      type: "customer",
      id: UUID,
      first_name: "Ada",
      last_name: "Lovelace",
      source: "webhook",
    };
    const result = mapPayload(payload);

    expect(result.ok).toBe(true);
    if (!result.ok || result.record.kind !== "customer") return;
    expect(result.record.externalId).toBe(UUID);
    expect(result.record.firstName).toBe("Ada");
    expect(result.record.data).toEqual(payload);
  });

  it("maps an order and carries the upstream customer id", () => {
    const result = mapPayload({
      type: "order",
      id: UUID,
      customer_id: CUSTOMER_UUID,
      value: 19.99,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.record.kind !== "order") return;
    expect(result.record.externalCustomerId).toBe(CUSTOMER_UUID);
    expect(result.record.value).toBe("19.99");
  });

  it("accepts value as a string and does not route money through a float", () => {
    const result = mapPayload({ type: "order", id: UUID, value: "12345678.91" });
    if (!result.ok || result.record.kind !== "order") throw new Error("expected order");
    expect(result.record.value).toBe("12345678.91");
  });

  it("leaves value null when it is absent or not a number", () => {
    for (const value of [undefined, null, "", "abc", {}]) {
      const result = mapPayload({ type: "order", id: UUID, value });
      if (!result.ok || result.record.kind !== "order") throw new Error("expected order");
      expect(result.record.value).toBeNull();
    }
  });

  it("leaves an order unlinked when no customer_id is given", () => {
    const result = mapPayload({ type: "order", id: UUID });
    if (!result.ok || result.record.kind !== "order") throw new Error("expected order");
    expect(result.record.externalCustomerId).toBeNull();
  });

  it("leaves customer names null when they are missing", () => {
    const result = mapPayload({ type: "customer", id: UUID });
    if (!result.ok || result.record.kind !== "customer") throw new Error("expected customer");
    expect(result.record.firstName).toBeNull();
    expect(result.record.lastName).toBeNull();
  });

  it("rejects an unknown type and says which one", () => {
    const result = mapPayload({ type: "invoice", id: UUID });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("invoice");
  });

  it("rejects a payload with no id", () => {
    const result = mapPayload({ type: "order" });
    expect(result.ok).toBe(false);
  });
});

describe("parseMessage", () => {
  it("parses a JSON string into a record", () => {
    const result = parseMessage(JSON.stringify({ type: "customer", id: UUID }));
    expect(result.ok).toBe(true);
  });

  it("rejects malformed JSON rather than throwing", () => {
    const result = parseMessage("{not json");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("JSON");
  });

  it("rejects a JSON array", () => {
    const result = parseMessage("[]");
    expect(result.ok).toBe(false);
  });
});
