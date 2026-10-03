import { createLogging } from "@app/logging";
import { loadConfig } from "./config.js";
import { seedGeneration } from "./factories.js";
import { createWorld, nextRecord, type GeneratedRecord } from "./generate.js";
import { fakerRng } from "./random.js";
import { createSchedule, type ScheduleMode } from "./schedule.js";

const config = loadConfig();

const { logger, shutdown: shutdownLogging } = createLogging({
  serviceName: process.env.OTEL_SERVICE_NAME ?? "simulator",
});

seedGeneration(config.seed);

const world = createWorld();
const schedule = createSchedule(config.schedule, fakerRng);

const counts = { accepted: 0, rejected: 0, unexpected: 0, failed: 0, total: 0 };
const modes: Record<ScheduleMode, number> = { steady: 0, burst: 0, quiet: 0 };

let running = true;
let wake: (() => void) | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const finish = (): void => {
      clearTimeout(timer);
      wake = null;
      resolve();
    };
    const timer = setTimeout(finish, ms);
    wake = finish;
  });
}

async function send(record: GeneratedRecord): Promise<number | null> {
  let response: Response;
  try {
    response = await fetch(config.ingestUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(record.payload),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    counts.failed += 1;
    logger.error(
      { err: error, url: config.ingestUrl },
      "could not reach the ingest api",
    );
    return null;
  }

  const body = await response.text();

  if (response.status === record.expect) {
    if (response.status === 202) counts.accepted += 1;
    else counts.rejected += 1;
    return response.status;
  }

  counts.unexpected += 1;
  logger.warn(
    {
      kind: record.kind,
      note: record.note,
      expected: record.expect,
      status: response.status,
      body: body.slice(0, 200),
    },
    "ingest answered something other than what this record expected",
  );
  return response.status;
}

const summary = setInterval(() => {
  logger.info(
    {
      ...counts,
      modes,
      customers: world.customers.length,
      orders: world.orders.length,
      pending: world.pending.length,
    },
    "simulator summary",
  );
  for (const key of Object.keys(counts) as (keyof typeof counts)[]) counts[key] = 0;
  for (const key of Object.keys(modes) as ScheduleMode[]) modes[key] = 0;
}, config.summaryMs);

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    logger.info({ signal }, "shutting down");
    running = false;
    wake?.();
  });
}

logger.info(
  {
    ingestUrl: config.ingestUrl,
    seed: config.seed,
    meanIntervalMs: config.schedule.meanIntervalMs,
    anomalyRate: config.generator.anomalyRate,
    maxRecords: config.maxRecords || undefined,
  },
  "simulator started",
);

let produced = 0;
while (running && (config.maxRecords === 0 || produced < config.maxRecords)) {
  const record = nextRecord(world, config.generator);
  produced += 1;
  counts.total += 1;

  const status = await send(record);

  const tick = schedule.next();
  modes[tick.mode] += 1;

  logger.debug(
    {
      kind: record.kind,
      note: record.note,
      id: record.payload.id,
      status,
      mode: tick.mode,
      delayMs: Math.round(tick.delayMs),
    },
    "sent",
  );

  if (!running) break;
  await sleep(tick.delayMs);
}

clearInterval(summary);
logger.info({ produced }, "simulator stopped");
await shutdownLogging();
