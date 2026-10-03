import { SeverityNumber } from "@opentelemetry/api-logs";

const LEVELS: ReadonlyArray<{ pino: number; number: SeverityNumber; text: string }> = [
  { pino: 10, number: SeverityNumber.TRACE, text: "TRACE" },
  { pino: 20, number: SeverityNumber.DEBUG, text: "DEBUG" },
  { pino: 30, number: SeverityNumber.INFO, text: "INFO" },
  { pino: 40, number: SeverityNumber.WARN, text: "WARN" },
  { pino: 50, number: SeverityNumber.ERROR, text: "ERROR" },
  { pino: 60, number: SeverityNumber.FATAL, text: "FATAL" },
];

export function severityFor(level: unknown): { number: SeverityNumber; text: string } {
  const value = typeof level === "number" ? level : Number(level);
  if (!Number.isFinite(value)) {
    return { number: SeverityNumber.UNSPECIFIED, text: "UNSPECIFIED" };
  }

  let match = LEVELS[0]!;
  for (const level of LEVELS) {
    if (value >= level.pino) match = level;
  }
  return { number: match.number, text: match.text };
}

export function flattenAttributes(
  source: Record<string, unknown>,
  prefix = "",
  depth = 0,
): Record<string, string | number | boolean | Array<string | number | boolean>> {
  const out: Record<string, string | number | boolean | Array<string | number | boolean>> = {};

  for (const [key, value] of Object.entries(source)) {
    const name = prefix ? `${prefix}.${key}` : key;

    if (value === null || value === undefined) continue;

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[name] = value;
      continue;
    }

    if (Array.isArray(value)) {
      const primitives = value.every(
        (item) =>
          typeof item === "string" || typeof item === "number" || typeof item === "boolean",
      );
      out[name] = primitives
        ? (value as Array<string | number | boolean>)
        : safeStringify(value);
      continue;
    }

    if (typeof value === "object" && depth < 3) {
      Object.assign(out, flattenAttributes(value as Record<string, unknown>, name, depth + 1));
      continue;
    }

    out[name] = safeStringify(value);
  }

  return out;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
