import type { GeneratorConfig } from "./generate.js";
import type { ScheduleConfig } from "./schedule.js";

export interface Config {
  ingestUrl: string;
  timeoutMs: number;
  maxRecords: number;
  summaryMs: number;
  seed: number;
  generator: GeneratorConfig;
  schedule: ScheduleConfig;
}

function number(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} is not a number: ${raw}`);
  return value;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

export function loadConfig(env = process.env): Config {
  const ingestUrl = env.INGEST_URL;
  if (!ingestUrl) throw new Error("INGEST_URL is not set");

  return {
    ingestUrl,
    timeoutMs: number(env, "SIMULATOR_TIMEOUT_MS", 5000),
    maxRecords: number(env, "SIMULATOR_MAX_RECORDS", 0),
    summaryMs: number(env, "SIMULATOR_SUMMARY_MS", 30000),
    seed: number(env, "SIMULATOR_SEED", randomSeed()),
    generator: {
      customerShare: number(env, "SIMULATOR_CUSTOMER_SHARE", 0.25),
      resendRate: number(env, "SIMULATOR_RESEND_RATE", 0.08),
      anomalyRate: number(env, "SIMULATOR_ANOMALY_RATE", 0),
      unlinkedRate: number(env, "SIMULATOR_UNLINKED_RATE", 0.1),
      memory: number(env, "SIMULATOR_MEMORY", 500),
    },
    schedule: {
      meanIntervalMs: number(env, "SIMULATOR_MEAN_INTERVAL_MS", 2000),
      minIntervalMs: number(env, "SIMULATOR_MIN_INTERVAL_MS", 100),
      maxIntervalMs: number(env, "SIMULATOR_MAX_INTERVAL_MS", 15000),
      burstChance: number(env, "SIMULATOR_BURST_CHANCE", 0.05),
      burstMin: number(env, "SIMULATOR_BURST_MIN", 3),
      burstMax: number(env, "SIMULATOR_BURST_MAX", 25),
      burstIntervalMs: number(env, "SIMULATOR_BURST_INTERVAL_MS", 50),
      quietChance: number(env, "SIMULATOR_QUIET_CHANCE", 0.3),
      quietMinMs: number(env, "SIMULATOR_QUIET_MIN_MS", 10000),
      quietMaxMs: number(env, "SIMULATOR_QUIET_MAX_MS", 60000),
    },
  };
}
