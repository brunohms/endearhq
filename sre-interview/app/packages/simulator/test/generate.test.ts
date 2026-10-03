import { beforeEach, describe, expect, it } from "vitest";
import { seedGeneration } from "../src/factories.js";
import { createWorld, nextRecord, type GeneratorConfig } from "../src/generate.js";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const config = (overrides: Partial<GeneratorConfig> = {}): GeneratorConfig => ({
  customerShare: 0.25,
  resendRate: 0.08,
  anomalyRate: 0,
  unlinkedRate: 0.1,
  memory: 500,
  ...overrides,
});

function run(count: number, generator: GeneratorConfig) {
  const world = createWorld();
  const records = Array.from({ length: count }, () => nextRecord(world, generator));
  return { world, records };
}

beforeEach(() => {
  seedGeneration(1234);
});

describe("nextRecord", () => {
  it("opens with a customer, because there is nothing to reference yet", () => {
    const world = createWorld();
    expect(nextRecord(world, config({ customerShare: 0 })).kind).toBe("customer");
  });

  it("only sends payloads the ingest API accepts", () => {
    const { records } = run(500, config());

    for (const { payload } of records) {
      expect(payload.type).toMatch(/^(customer|order)$/);
      expect(payload.id).toMatch(UUID);
    }
  });

  it("replays exactly from the same seed, sequence numbers included", () => {
    seedGeneration(99);
    const first = run(200, config({ anomalyRate: 0.1 })).records;
    seedGeneration(99);
    const second = run(200, config({ anomalyRate: 0.1 })).records;

    expect(second).toEqual(first);
  });

  it("varies the payload beyond the fields that have columns", () => {
    const { records } = run(300, config({ customerShare: 1 }));
    const keys = new Set(records.flatMap(({ payload }) => Object.keys(payload)));

    expect(keys).toContain("channel");
    expect(keys).toContain("email");
    const missingName = records.filter(({ payload }) => !payload.last_name);
    expect(missingName.length).toBeGreaterThan(0);
  });

  it("sends order values as both numbers and strings", () => {
    const orders = run(500, config({ customerShare: 0 })).records.filter(
      (record) => record.kind === "order",
    );

    expect(orders.some(({ payload }) => typeof payload.value === "number")).toBe(true);
    expect(orders.some(({ payload }) => typeof payload.value === "string")).toBe(true);
  });

  it("keeps real order values inside numeric(12,2)", () => {
    const orders = run(1000, config({ customerShare: 0 })).records.filter(
      (record) => record.kind === "order",
    );

    for (const { payload } of orders) {
      expect(Number(payload.value)).toBeGreaterThan(0);
      expect(Number(payload.value)).toBeLessThanOrEqual(9_999_999.99);
    }
  });

  it("resends ids it has already sent, so the write is an upsert", () => {
    const { world, records } = run(200, config({ resendRate: 1 }));
    const ids = records.map(({ payload }) => payload.id as string);

    expect(new Set(ids).size).toBeLessThan(ids.length);
    expect(world.customers.length + world.orders.length).toBeLessThan(ids.length);
  });

  it("lets an order name a customer that has not been sent, then sends it", () => {
    const world = createWorld();
    const unlinked = config({ customerShare: 0, unlinkedRate: 1 });
    for (let i = 0; i < 50; i++) nextRecord(world, unlinked);

    const waiting = [...world.pending];
    expect(waiting.length).toBeGreaterThan(0);

    const customers = config({ customerShare: 1, unlinkedRate: 0 });
    const sent = Array.from({ length: 50 }, () =>
      nextRecord(world, customers).payload.id as string,
    );

    expect(sent.some((id) => waiting.includes(id))).toBe(true);
    expect(world.pending.length).toBeLessThan(waiting.length);
  });

  it("sends nothing broken unless asked to", () => {
    const { records } = run(500, config({ anomalyRate: 0 }));
    expect(records.some((record) => record.kind === "anomaly")).toBe(false);
  });

  it("breaks payloads in ways the API rejects, and one it does not", () => {
    const { records } = run(400, config({ anomalyRate: 1 }));
    expect(records.every((record) => record.kind === "anomaly")).toBe(true);

    const rejected = records.filter((record) => record.expect === 400);
    expect(rejected.length).toBeGreaterThan(0);
    for (const { payload } of rejected) {
      const badType = !["customer", "order"].includes(payload.type as string);
      const badId = typeof payload.id !== "string" || !UUID.test(payload.id);
      expect(badType || badId).toBe(true);
    }

    const accepted = records.filter((record) => record.expect === 202);
    expect(accepted.length).toBeGreaterThan(0);
    for (const { payload } of accepted) {
      expect(payload.type).toBe("order");
      expect(payload.id).toMatch(UUID);
      expect(Number(payload.value)).toBeGreaterThan(9_999_999.99);
    }
  });

  it("stays bounded, because this runs for weeks in a 128Mi pod", () => {
    const { world } = run(2000, config({ memory: 10, unlinkedRate: 0.5 }));

    expect(world.customers.length).toBeLessThanOrEqual(10);
    expect(world.orders.length).toBeLessThanOrEqual(10);
    expect(world.pending.length).toBeLessThanOrEqual(10);
  });
});
