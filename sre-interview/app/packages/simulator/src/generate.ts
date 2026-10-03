import { faker } from "@faker-js/faker/locale/en";
import { customerFactory, orderFactory } from "./factories.js";

export interface GeneratorConfig {
  customerShare: number;
  resendRate: number;
  anomalyRate: number;
  unlinkedRate: number;
  memory: number;
}

export type RecordKind = "customer" | "order" | "anomaly";

export interface GeneratedRecord {
  kind: RecordKind;
  expect: 202 | 400;
  note?: string;
  payload: Record<string, unknown>;
}

export interface World {
  customers: string[];
  orders: string[];
  pending: string[];
}

export function createWorld(): World {
  return { customers: [], orders: [], pending: [] };
}

function remember(ids: string[], id: string, limit: number): void {
  if (!ids.includes(id)) ids.push(id);
  if (ids.length > limit) ids.splice(0, ids.length - limit);
}

const sometimes = (probability: number): boolean =>
  faker.datatype.boolean({ probability });

function anomaly(): GeneratedRecord {
  const note = faker.helpers.weightedArrayElement([
    { weight: 3, value: "unknown-type" },
    { weight: 3, value: "bad-id" },
    { weight: 2, value: "missing-id" },
    { weight: 2, value: "overflow" },
  ]);

  switch (note) {
    case "unknown-type":
      return {
        kind: "anomaly",
        expect: 400,
        note,
        payload: {
          ...customerFactory.build(),
          type: faker.helpers.arrayElement(["refund", "shipment", "customer_v2"]),
        },
      };

    case "bad-id":
      return {
        kind: "anomaly",
        expect: 400,
        note,
        payload: { ...customerFactory.build(), id: `cus_${faker.string.numeric(8)}` },
      };

    case "missing-id": {
      const { id, ...payload } = orderFactory.build();
      void id;
      return { kind: "anomaly", expect: 400, note, payload };
    }

    default:
      return {
        kind: "anomaly",
        expect: 202,
        note,
        payload: orderFactory.transient({ overflow: true }).build(),
      };
  }
}

export function nextRecord(world: World, config: GeneratorConfig): GeneratedRecord {
  if (sometimes(config.anomalyRate)) return anomaly();

  const wantCustomer =
    world.customers.length === 0 || sometimes(config.customerShare);

  if (wantCustomer) {
    const resend = world.customers.length > 0 && sometimes(config.resendRate);

    const claimed =
      !resend && world.pending.length > 0 && sometimes(0.7)
        ? world.pending.shift()
        : undefined;

    const id = resend
      ? faker.helpers.arrayElement(world.customers)
      : (claimed ?? faker.string.uuid());
    remember(world.customers, id, config.memory);

    return {
      kind: "customer",
      expect: 202,
      ...(resend ? { note: "resend" } : claimed ? { note: "claims-pending" } : {}),
      payload: customerFactory.build({ id }),
    };
  }

  const resend = world.orders.length > 0 && sometimes(config.resendRate);
  const id = resend ? faker.helpers.arrayElement(world.orders) : faker.string.uuid();
  const notes: string[] = resend ? ["resend"] : [];

  let customerId: string | undefined;
  if (sometimes(config.unlinkedRate)) {
    customerId = faker.string.uuid();
    remember(world.pending, customerId, config.memory);
    notes.push("unlinked");
  } else if (sometimes(0.03)) {
    customerId = undefined;
    notes.push("no-customer");
  } else {
    customerId = faker.helpers.arrayElement(world.customers);
  }

  remember(world.orders, id, config.memory);

  return {
    kind: "order",
    expect: 202,
    ...(notes.length > 0 ? { note: notes.join("+") } : {}),
    payload: orderFactory.build({ id, ...(customerId ? { customer_id: customerId } : {}) }),
  };
}
