import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var afloatSql: postgres.Sql | undefined;
}

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for database access.");
  }
  return connectionString;
}

const sql =
  globalThis.afloatSql ??
  postgres(getConnectionString(), {
    max: 1,
    prepare: false
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.afloatSql = sql;
}

export const db = drizzle(sql, { schema });
export type Database = typeof db;
