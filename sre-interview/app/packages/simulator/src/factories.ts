import { faker } from "@faker-js/faker/locale/en";
import { Factory } from "fishery";
import { fakerRng, normal } from "./random.js";

export type CustomerPayload = {
  type: "customer";
  id: string;
  sequence: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  tier?: string;
  marketing_opt_in?: boolean;
  channel?: string;
  region?: string;
  request_id?: string;
}

export type OrderPayload = {
  type: "order";
  id: string;
  sequence: number;
  customer_id?: string;
  value: number | string;
  currency?: string;
  status?: string;
  items?: number;
  discount?: number;
  channel?: string;
  region?: string;
  request_id?: string;
}

export type Payload = CustomerPayload | OrderPayload;

export type OrderTransient = {
  overflow: boolean;
}

const TIERS = ["free", "standard", "premium", "enterprise"];
const CHANNELS = ["web", "ios", "android", "partner-api", "pos", "phone"];
const REGIONS = ["us-east", "us-west", "eu-west", "eu-central", "ap-south"];
const STATUSES = ["placed", "paid", "shipped", "refunded", "cancelled"];

const sometimes = (probability: number): boolean =>
  faker.datatype.boolean({ probability });

function extras(): Pick<Payload, "channel" | "region" | "request_id"> {
  return {
    ...(sometimes(0.7) ? { channel: faker.helpers.arrayElement(CHANNELS) } : {}),
    ...(sometimes(0.4) ? { region: faker.helpers.arrayElement(REGIONS) } : {}),
    ...(sometimes(0.3) ? { request_id: faker.string.uuid() } : {}),
  };
}

function orderValue(): number {
  const value = Math.exp(normal(fakerRng, Math.log(45), 1.1));
  return Math.min(Math.max(Math.round(value * 100) / 100, 0.01), 9_999_999.99);
}

export const customerFactory = Factory.define<CustomerPayload>(
  ({ sequence, params }) => {
    const firstName = sometimes(0.98) ? faker.person.firstName() : undefined;
    const lastName = sometimes(0.95) ? faker.person.lastName() : undefined;

    return {
      type: "customer",
      id: faker.string.uuid(),
      sequence,
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {}),
      ...(sometimes(0.6)
        ? {
            email: faker.internet.email({
              firstName: params.first_name ?? firstName,
              lastName: params.last_name ?? lastName,
            }),
          }
        : {}),
      ...(sometimes(0.5) ? { tier: faker.helpers.arrayElement(TIERS) } : {}),
      ...(sometimes(0.2) ? { marketing_opt_in: faker.datatype.boolean() } : {}),
      ...extras(),
    };
  },
);

export const orderFactory = Factory.define<OrderPayload, OrderTransient>(
  ({ sequence, transientParams }) => {
    const value = orderValue();

    return {
      type: "order",
      id: faker.string.uuid(),
      sequence,
      value: transientParams.overflow
        ? "99999999999.99"
        : sometimes(0.3)
          ? value.toFixed(2)
          : value,
      ...(sometimes(0.8) ? { currency: faker.finance.currencyCode() } : {}),
      ...(sometimes(0.6) ? { status: faker.helpers.arrayElement(STATUSES) } : {}),
      ...(sometimes(0.3) ? { items: faker.number.int({ min: 1, max: 12 }) } : {}),
      ...(sometimes(0.1)
        ? { discount: faker.number.float({ min: 0, max: 0.4, fractionDigits: 2 }) }
        : {}),
      ...extras(),
    };
  },
);

export function seedGeneration(seed: number): void {
  faker.seed(seed);
  customerFactory.rewindSequence();
  orderFactory.rewindSequence();
}
