import "server-only";

import { Pool, type QueryResultRow } from "pg";

declare global {
  var __misaPostgresPool: Pool | undefined;
}

export function database() {
  const connectionString = process.env.DATABASE_URL || process.env.MISA_DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for server data access.");
  if (!global.__misaPostgresPool) {
    const configuredMax = Number(process.env.DATABASE_MAX_CONNECTIONS || 5);
    global.__misaPostgresPool = new Pool({
      connectionString,
      max: Number.isFinite(configuredMax) ? Math.max(1, Math.min(Math.floor(configuredMax), 20)) : 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
    });
  }
  return global.__misaPostgresPool;
}

export async function one<T extends QueryResultRow>(sql: string, values: unknown[] = []) {
  const result = await database().query<T>(sql, values);
  return result.rows[0] || null;
}
