import { createDatabase, runMigrations } from "@app/db";
import { createLogging } from "@app/logging";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createProducer, ensureTopic } from "./kafka.js";

const config = loadConfig();

const { logger, shutdown: shutdownLogging } = createLogging({
  serviceName: process.env.OTEL_SERVICE_NAME ?? "backend",
});

logger.info({ databaseUrl: redact(config.databaseUrl) }, "running migrations");
await runMigrations(config.databaseUrl, new URL("../drizzle", import.meta.url).pathname);

logger.info({ topic: config.ingestTopic, brokers: config.kafkaBrokers }, "ensuring ingest topic");
await ensureTopic(config.kafkaBrokers, config.ingestTopic, 1);

const db = createDatabase(config.databaseUrl);
const producer = await createProducer(config.kafkaBrokers);
const app = buildApp({
  db,
  producer,
  ingestTopic: config.ingestTopic,
  loggerInstance: logger,
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    app.log.info({ signal }, "shutting down");
    void app
      .close()
      .then(() => producer.disconnect())
      .then(() => shutdownLogging())
      .then(() => process.exit(0));
  });
}

await app.listen({ port: config.port, host: config.host });
logger.info({ port: config.port, host: config.host }, "backend listening");

function redact(url: string): string {
  return url.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
}
