import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const INGEST_URL = "http://backend:3000/ingest";

describe("loadConfig", () => {
  it("needs somewhere to send to", () => {
    expect(() => loadConfig({})).toThrow(/INGEST_URL/);
  });

  it("runs on defaults, and generates nothing broken unless asked", () => {
    const config = loadConfig({ INGEST_URL });

    expect(config.schedule.meanIntervalMs).toBe(2000);
    expect(config.generator.anomalyRate).toBe(0);
    expect(config.maxRecords).toBe(0);
  });

  it("refuses a knob that is not a number, rather than running on NaN", () => {
    expect(() =>
      loadConfig({ INGEST_URL, SIMULATOR_MEAN_INTERVAL_MS: "fast" }),
    ).toThrow(/SIMULATOR_MEAN_INTERVAL_MS/);
  });

  it("takes a seed, so a run can be replayed", () => {
    expect(loadConfig({ INGEST_URL, SIMULATOR_SEED: "7" }).seed).toBe(7);
  });
});
