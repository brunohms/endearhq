export type IngestType = "customer" | "order";

export interface IngestEnvelope {
  type: IngestType;
  id: string;
  [key: string]: unknown;
}

export type ValidationResult =
  | { ok: true; value: IngestEnvelope }
  | { ok: false; error: string };

const TYPES: readonly string[] = ["customer", "order"];

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateIngestPayload(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "body must be a JSON object" };
  }

  const payload = body as Record<string, unknown>;

  if (typeof payload.type !== "string" || !TYPES.includes(payload.type)) {
    return { ok: false, error: `type must be one of: ${TYPES.join(", ")}` };
  }

  if (typeof payload.id !== "string" || !UUID.test(payload.id)) {
    return { ok: false, error: "id must be a uuid" };
  }

  return { ok: true, value: payload as IngestEnvelope };
}
