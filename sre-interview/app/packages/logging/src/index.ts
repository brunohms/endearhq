import { SeverityNumber, logs as logsApi } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import pino, { type Logger } from "pino";
import { flattenAttributes, severityFor } from "./severity.js";

export { flattenAttributes, severityFor } from "./severity.js";

export interface LoggingOptions {
  serviceName: string;
  serviceVersion?: string;
  endpoint?: string;
  level?: string;
}

export interface Logging {
  logger: Logger;
  shutdown: () => Promise<void>;
}

export function createLogging(options: LoggingOptions): Logging {
  const endpoint = options.endpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const level = options.level ?? process.env.LOG_LEVEL ?? "info";

  if (!endpoint) {
    return {
      logger: pino({ level }),
      shutdown: async () => {},
    };
  }

  const provider = new LoggerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.serviceName,
      [ATTR_SERVICE_VERSION]: options.serviceVersion ?? "0.1.0",
    }),
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({ url: `${endpoint.replace(/\/$/, "")}/v1/logs` }),
        scheduledDelayMillis: 1000,
        maxQueueSize: 512,
        maxExportBatchSize: 128,
      }),
    ],
  });
  logsApi.setGlobalLoggerProvider(provider);
  const otelLogger = provider.getLogger(options.serviceName);

  const logger = pino(
    { level },
    pino.multistream([
      { level, stream: process.stdout },
      { level, stream: { write: (line: string) => emit(line) } },
    ]),
  );

  function emit(line: string): void {
    try {
      const record = JSON.parse(line) as Record<string, unknown>;
      const { level, time, msg, ...rest } = record;
      const severity = severityFor(level);

      otelLogger.emit({
        severityNumber: severity.number,
        severityText: severity.text,
        body: typeof msg === "string" ? msg : line,
        timestamp: typeof time === "number" ? time : Date.now(),
        attributes: flattenAttributes(rest),
      });
    } catch {
    }
  }

  return {
    logger,
    shutdown: async () => {
      try {
        await provider.shutdown();
      } catch {
      }
    },
  };
}

export { SeverityNumber };
export type { Logger };
