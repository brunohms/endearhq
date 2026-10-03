export interface TelemetryConfig {
  endpoint: string | undefined;
  serviceName: string;
  serviceVersion: string;
  ignorePaths: string[];
}

export function loadConfig(env = process.env): TelemetryConfig {
  return {
    endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, "") || undefined,
    serviceName: env.OTEL_SERVICE_NAME ?? "unknown-service",
    serviceVersion: env.OTEL_SERVICE_VERSION ?? "0.1.0",
    ignorePaths: (env.OTEL_IGNORE_PATHS ?? "/health").split(",").filter(Boolean),
  };
}
