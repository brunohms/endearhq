import { SeverityNumber } from "@opentelemetry/api-logs";
import { describe, expect, it } from "vitest";
import { flattenAttributes, severityFor } from "../src/severity.js";

describe("severityFor", () => {
  it("maps each of Pino's levels to the matching OTel severity", () => {
    expect(severityFor(10)).toEqual({ number: SeverityNumber.TRACE, text: "TRACE" });
    expect(severityFor(30)).toEqual({ number: SeverityNumber.INFO, text: "INFO" });
    expect(severityFor(40)).toEqual({ number: SeverityNumber.WARN, text: "WARN" });
    expect(severityFor(50)).toEqual({ number: SeverityNumber.ERROR, text: "ERROR" });
    expect(severityFor(60)).toEqual({ number: SeverityNumber.FATAL, text: "FATAL" });
  });

  it("rounds a custom level down to the standard one below it", () => {
    expect(severityFor(35).text).toBe("INFO");
    expect(severityFor(59).text).toBe("ERROR");
  });

  it("does not throw on a level it cannot read", () => {
    expect(severityFor(undefined).number).toBe(SeverityNumber.UNSPECIFIED);
    expect(severityFor("nonsense").number).toBe(SeverityNumber.UNSPECIFIED);
  });
});

describe("flattenAttributes", () => {
  it("keeps primitives as they are", () => {
    expect(flattenAttributes({ a: "x", b: 1, c: true })).toEqual({ a: "x", b: 1, c: true });
  });

  it("flattens a nested object into dotted keys", () => {
    expect(flattenAttributes({ req: { method: "POST", url: "/ingest" } })).toEqual({
      "req.method": "POST",
      "req.url": "/ingest",
    });
  });

  it("keeps arrays of primitives, which OTel supports", () => {
    expect(flattenAttributes({ tags: ["a", "b"] })).toEqual({ tags: ["a", "b"] });
  });

  it("serialises an array of objects rather than dropping it", () => {
    expect(flattenAttributes({ items: [{ a: 1 }] })).toEqual({ items: '[{"a":1}]' });
  });

  it("drops null and undefined instead of sending empty attributes", () => {
    expect(flattenAttributes({ a: null, b: undefined, c: 1 })).toEqual({ c: 1 });
  });

  it("stops descending before a deeply nested payload runs away", () => {
    const deep = { a: { b: { c: { d: { e: "bottom" } } } } };
    const out = flattenAttributes(deep);
    expect(JSON.stringify(out)).toContain("bottom");
  });

  it("survives a self-referencing object", () => {
    const loop: Record<string, unknown> = { name: "loop" };
    loop.self = loop;
    expect(() => flattenAttributes(loop)).not.toThrow();
    expect(flattenAttributes(loop).name).toBe("loop");
  });
});
