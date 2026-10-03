import { FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import type { IncomingMessage } from "node:http";
import { loadConfig, type TelemetryConfig } from "./config.js";

export function createSdk(config: TelemetryConfig = loadConfig()): NodeSDK | undefined {
  if (!config.endpoint) return undefined;

  return new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion,
    }),
    traceExporter: new OTLPTraceExporter({ url: `${config.endpoint}/v1/traces` }),
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (request: IncomingMessage) => {
          const path = (request.url ?? "").split("?")[0] ?? "";
          return config.ignorePaths.includes(path);
        },
      }),
      new FastifyInstrumentation(),
      new PgInstrumentation({ enhancedDatabaseReporting: false }),
      new PinoInstrumentation(),
    ],
  });
}
