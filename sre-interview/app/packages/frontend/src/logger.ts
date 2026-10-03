import pino from "pino";

const OTLP_LOGS_URL = "/v1/logs";
const SERVICE_NAME = "frontend";

const SEVERITY: Record<string, { number: number; text: string }> = {
  trace: { number: 1, text: "TRACE" },
  debug: { number: 5, text: "DEBUG" },
  info: { number: 9, text: "INFO" },
  warn: { number: 13, text: "WARN" },
  error: { number: 17, text: "ERROR" },
  fatal: { number: 21, text: "FATAL" },
};

type AttributeValue = string | number | boolean;

function attributes(source: Record<string, AttributeValue>) {
  return Object.entries(source).map(([key, value]) => ({
    key,
    value:
      typeof value === "number"
        ? Number.isInteger(value)
          ? { intValue: value }
          : { doubleValue: value }
        : typeof value === "boolean"
          ? { boolValue: value }
          : { stringValue: String(value) },
  }));
}

function send(level: string, logEvent: pino.LogEvent): void {
  const severity = SEVERITY[level] ?? SEVERITY.info!;

  const parts = logEvent.messages;
  const message = parts.find((part) => typeof part === "string") ?? "";
  const fields: Record<string, AttributeValue> = {};
  for (const part of parts) {
    if (part && typeof part === "object") {
      for (const [key, value] of Object.entries(part as Record<string, unknown>)) {
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          fields[key] = value;
        } else if (value !== null && value !== undefined) {
          fields[key] = JSON.stringify(value);
        }
      }
    }
  }

  const body = {
    resourceLogs: [
      {
        resource: {
          attributes: attributes({
            "service.name": SERVICE_NAME,
            "service.version": "0.1.0",
          }),
        },
        scopeLogs: [
          {
            scope: { name: "frontend" },
            logRecords: [
              {
                timeUnixNano: String(BigInt(logEvent.ts) * 1_000_000n),
                severityNumber: severity.number,
                severityText: severity.text,
                body: { stringValue: message },
                attributes: attributes({
                  ...fields,
                  "browser.url": window.location.pathname,
                }),
              },
            ],
          },
        ],
      },
    ],
  };

  void fetch(OTLP_LOGS_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}

export const logger = pino({
  level: "info",
  browser: {
    asObject: true,
    transmit: { level: "info", send },
  },
});
