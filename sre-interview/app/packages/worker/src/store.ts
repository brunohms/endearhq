import { customers, orders, type Database } from "@app/db";
import { eq, sql } from "drizzle-orm";
import type { MappedRecord } from "./mapping.js";

export async function writeRecord(
  db: Database,
  record: MappedRecord,
): Promise<{ resolvedCustomer: boolean }> {
  if (record.kind === "customer") {
    await db
      .insert(customers)
      .values({
        externalId: record.externalId,
        firstName: record.firstName,
        lastName: record.lastName,
        data: record.data,
      })
      .onConflictDoUpdate({
        target: customers.externalId,
        set: {
          firstName: record.firstName,
          lastName: record.lastName,
          data: record.data,
          updatedAt: sql`now()`,
        },
      });
    return { resolvedCustomer: true };
  }

  let customerId: string | null = null;
  if (record.externalCustomerId) {
    const [match] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.externalId, record.externalCustomerId))
      .limit(1);
    customerId = match?.id ?? null;
  }

  await db
    .insert(orders)
    .values({
      externalId: record.externalId,
      customerId,
      value: record.value,
      data: record.data,
    })
    .onConflictDoUpdate({
      target: orders.externalId,
      set: {
        ...(customerId ? { customerId } : {}),
        value: record.value,
        data: record.data,
        updatedAt: sql`now()`,
      },
    });

  return { resolvedCustomer: customerId !== null };
}
