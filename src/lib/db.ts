import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  // Local dev: SQLite via the better-sqlite3 driver adapter. The adapter accepts
  // a `file:`-prefixed URL. Swap PrismaBetterSqlite3 for PrismaPg (and the
  // datasource provider) when moving to Postgres.
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
