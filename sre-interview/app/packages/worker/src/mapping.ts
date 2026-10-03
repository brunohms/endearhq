export interface RawPayload {
  type?: unknown;
  id?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  value?: unknown;
  customer_id?: unknown;
  [key: string]: unknown;
}

export interface CustomerRecord {
  kind: "customer";
  externalId: string;
  firstName: string | null;
  lastName: string | null;
  data: RawPayload;
}

export interface OrderRecord {
  kind: "order";
  externalId: string;
  externalCustomerId: string | null;
  value: string | null;
  data: RawPayload;
}

export type MappedRecord = CustomerRecord | OrderRecord;

export type MapResult =
  | { ok: true; record: MappedRecord }
  | { ok: false; reason: string };

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  return null;
}

function asNumericString(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

export function mapPayload(payload: RawPayload): MapResult {
  const externalId = asString(payload.id);
  if (!externalId) {
    return { ok: false, reason: "payload has no usable id" };
  }

  switch (payload.type) {
    case "customer":
      return {
        ok: true,
        record: {
          kind: "customer",
          externalId,
          firstName: asString(payload.first_name),
          lastName: asString(payload.last_name),
          data: payload,
        },
      };

    case "order":
      return {
        ok: true,
        record: {
          kind: "order",
          externalId,
          externalCustomerId: asString(payload.customer_id),
          value: asNumericString(payload.value),
          data: payload,
        },
      };

    default:
      return { ok: false, reason: `unknown type: ${String(payload.type)}` };
  }
}

export function parseMessage(raw: string): MapResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "message is not valid JSON" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: "message is not a JSON object" };
  }
  return mapPayload(parsed as RawPayload);
}
