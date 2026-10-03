import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase(url: string, max = 5) {
  const pool = new Pool({ connectionString: url, max });
  return drizzle(pool, { schema });
}

export function databaseUrlFromEnv(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}
