import { customers, orders, type Database } from "@app/db";
import { count, desc, eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";

export const apiRoutes =
  (db: Database): FastifyPluginAsync =>
  async function readApi(app) {
    app.get("/customers", async function listCustomers(request) {
      const { limit, offset } = parsePaging(request.query);

      const [rows, totals] = await Promise.all([
        db
          .select()
          .from(customers)
          .orderBy(desc(customers.createdAt), desc(customers.id))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(customers),
      ]);

      return { rows, total: totals[0]?.total ?? 0, limit, offset };
    });

    app.get("/orders", async function listOrders(request) {
      const { limit, offset } = parsePaging(request.query);

      const [rows, totals] = await Promise.all([
        db
          .select({
            id: orders.id,
            externalId: orders.externalId,
            value: orders.value,
            data: orders.data,
            createdAt: orders.createdAt,
            updatedAt: orders.updatedAt,
            customerId: orders.customerId,
            customerFirstName: customers.firstName,
            customerLastName: customers.lastName,
          })
          .from(orders)
          .leftJoin(customers, eq(orders.customerId, customers.id))
          .orderBy(desc(orders.createdAt), desc(orders.id))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(orders),
      ]);

      return { rows, total: totals[0]?.total ?? 0, limit, offset };
    });
  };

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export interface Paging {
  limit: number;
  offset: number;
}

export function parsePaging(query: unknown): Paging {
  const params = (query ?? {}) as Record<string, unknown>;
  return {
    limit: bounded(params.limit, DEFAULT_LIMIT, 1, MAX_LIMIT),
    offset: bounded(params.offset, 0, 0, Number.MAX_SAFE_INTEGER),
  };
}

function bounded(raw: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.min(Math.floor(parsed), max);
}
