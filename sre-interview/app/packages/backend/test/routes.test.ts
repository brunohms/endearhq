import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { parsePaging } from "../src/routes/api.js";
import type { Producer } from "../src/kafka.js";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function fakeProducer() {
  const sent: Array<{ topic: string; key: string; value: string }> = [];
  const producer: Producer = {
    async send(topic, key, value) {
      sent.push({ topic, key, value });
    },
    async disconnect() {},
  };
  return { producer, sent };
}

function appWith(producer: Producer) {
  return buildApp({
    db: {} as never,
    producer,
    ingestTopic: "ingest",
    loggerInstance: false,
  });
}

describe("POST /ingest", () => {
  it("accepts a valid payload and publishes it verbatim", async () => {
    const { producer, sent } = fakeProducer();
    const app = appWith(producer);
    const payload = { type: "order", id: UUID, value: 42, extra: "kept" };

    const response = await app.inject({
      method: "POST",
      url: "/ingest",
      payload,
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ status: "accepted", id: UUID });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.topic).toBe("ingest");
    expect(sent[0]?.key).toBe(UUID);
    expect(JSON.parse(sent[0]?.value ?? "{}")).toEqual(payload);

    await app.close();
  });

  it("rejects an invalid payload without publishing anything", async () => {
    const { producer, sent } = fakeProducer();
    const app = appWith(producer);

    const response = await app.inject({
      method: "POST",
      url: "/ingest",
      payload: { type: "invoice", id: UUID },
    });

    expect(response.statusCode).toBe(400);
    expect(sent).toHaveLength(0);

    await app.close();
  });

  it("surfaces a publish failure rather than reporting success", async () => {
    const producer: Producer = {
      send: vi.fn().mockRejectedValue(new Error("broker down")),
      disconnect: async () => {},
    };
    const app = appWith(producer);

    const response = await app.inject({
      method: "POST",
      url: "/ingest",
      payload: { type: "customer", id: UUID },
    });

    expect(response.statusCode).toBe(500);

    await app.close();
  });
});

describe("GET /health", () => {
  it("reports ok", async () => {
    const { producer } = fakeProducer();
    const app = appWith(producer);
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });
});

describe("parsePaging", () => {
  it("defaults when the values are missing or nonsense", () => {
    expect(parsePaging(undefined)).toEqual({ limit: 100, offset: 0 });
    expect(parsePaging({})).toEqual({ limit: 100, offset: 0 });
    expect(parsePaging({ limit: "abc", offset: "abc" })).toEqual({
      limit: 100,
      offset: 0,
    });
  });

  it("honours a sensible limit and caps an unreasonable one", () => {
    expect(parsePaging({ limit: "25" }).limit).toBe(25);
    expect(parsePaging({ limit: "10000" }).limit).toBe(500);
  });

  it("takes an offset, and refuses to page backwards past the start", () => {
    expect(parsePaging({ offset: "50" }).offset).toBe(50);
    expect(parsePaging({ offset: "0" }).offset).toBe(0);
    expect(parsePaging({ offset: "-25" }).offset).toBe(0);
  });

  it("floors a fractional page, rather than handing the database a decimal", () => {
    expect(parsePaging({ limit: "25.7", offset: "50.9" })).toEqual({
      limit: 25,
      offset: 50,
    });
  });
});
