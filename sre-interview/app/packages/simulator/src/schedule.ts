import { chance, exponential, float, int, type Rng } from "./random.js";

export interface ScheduleConfig {
  meanIntervalMs: number;
  minIntervalMs: number;
  maxIntervalMs: number;
  burstChance: number;
  burstMin: number;
  burstMax: number;
  burstIntervalMs: number;
  quietChance: number;
  quietMinMs: number;
  quietMaxMs: number;
}

export type ScheduleMode = "steady" | "burst" | "quiet";

export interface Tick {
  delayMs: number;
  mode: ScheduleMode;
}

export interface Schedule {
  next(): Tick;
}

export function createSchedule(config: ScheduleConfig, rng: Rng): Schedule {
  let remainingBurst = 0;
  let burstJustEnded = false;

  return {
    next(): Tick {
      if (remainingBurst > 0) {
        remainingBurst -= 1;
        if (remainingBurst === 0) burstJustEnded = true;
        return {
          delayMs: float(rng, config.burstIntervalMs * 0.5, config.burstIntervalMs * 1.5),
          mode: "burst",
        };
      }

      if (burstJustEnded) {
        burstJustEnded = false;
        if (chance(rng, config.quietChance)) {
          return {
            delayMs: float(rng, config.quietMinMs, config.quietMaxMs),
            mode: "quiet",
          };
        }
      }

      if (chance(rng, config.burstChance)) {
        remainingBurst = int(rng, config.burstMin, config.burstMax);
        return { delayMs: config.burstIntervalMs, mode: "burst" };
      }

      const delayMs = Math.min(
        Math.max(exponential(rng, config.meanIntervalMs), config.minIntervalMs),
        config.maxIntervalMs,
      );
      return { delayMs, mode: "steady" };
    },
  };
}
