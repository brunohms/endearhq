import { faker } from "@faker-js/faker/locale/en";
import { beforeEach, describe, expect, it } from "vitest";
import { fakerRng, type Rng } from "../src/random.js";
import { createSchedule, type ScheduleConfig } from "../src/schedule.js";

const config = (overrides: Partial<ScheduleConfig> = {}): ScheduleConfig => ({
  meanIntervalMs: 2000,
  minIntervalMs: 100,
  maxIntervalMs: 15000,
  burstChance: 0.05,
  burstMin: 3,
  burstMax: 25,
  burstIntervalMs: 50,
  quietChance: 0.3,
  quietMinMs: 10000,
  quietMaxMs: 60000,
  ...overrides,
});

const always = (value: number): Rng => () => value;

beforeEach(() => {
  faker.seed(4321);
});

describe("createSchedule", () => {
  it("keeps steady gaps inside the bounds, however the tail falls", () => {
    const schedule = createSchedule(config({ burstChance: 0 }), fakerRng);

    for (let i = 0; i < 2000; i++) {
      const tick = schedule.next();
      expect(tick.mode).toBe("steady");
      expect(tick.delayMs).toBeGreaterThanOrEqual(100);
      expect(tick.delayMs).toBeLessThanOrEqual(15000);
    }
  });

  it("spreads steady gaps out rather than repeating one interval", () => {
    const schedule = createSchedule(config({ burstChance: 0 }), fakerRng);
    const delays = Array.from({ length: 1000 }, () => schedule.next().delayMs);

    const mean = delays.reduce((a, b) => a + b, 0) / delays.length;
    expect(mean).toBeGreaterThan(1500);
    expect(mean).toBeLessThan(2500);
    expect(new Set(delays.map(Math.round)).size).toBeGreaterThan(500);
  });

  it("sends a burst back to back once one starts", () => {
    const schedule = createSchedule(
      config({ burstChance: 1, burstMin: 4, burstMax: 4, quietChance: 0 }),
      always(0),
    );

    const burst = Array.from({ length: 5 }, () => schedule.next());
    expect(burst.map((tick) => tick.mode)).toEqual([
      "burst",
      "burst",
      "burst",
      "burst",
      "burst",
    ]);
    for (const tick of burst) expect(tick.delayMs).toBeLessThanOrEqual(75);
  });

  it("can go quiet after a burst, which is the gap an alert has to survive", () => {
    const schedule = createSchedule(
      config({ burstChance: 1, burstMin: 2, burstMax: 2, quietChance: 1 }),
      always(0),
    );

    schedule.next();
    schedule.next();
    schedule.next();
    const quiet = schedule.next();

    expect(quiet.mode).toBe("quiet");
    expect(quiet.delayMs).toBeGreaterThanOrEqual(10000);
  });

  it("produces all three modes over a long enough run", () => {
    const schedule = createSchedule(config(), fakerRng);
    const seen = new Set(
      Array.from({ length: 5000 }, () => schedule.next().mode),
    );

    expect(seen).toEqual(new Set(["steady", "burst", "quiet"]));
  });
});
