import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma client singleton.
 *
 * Prisma 7 requires an explicit driver adapter. We use better-sqlite3 so the
 * project runs with no database server installed — see the portability note in
 * prisma/schema.prisma. Moving to PostgreSQL means swapping this adapter for
 * `@prisma/adapter-pg` and changing the datasource provider; no query code
 * changes, because nothing below the ORM is SQLite-specific.
 *
 * Next.js hot-reloads modules in development, which would otherwise create a
 * new client (and a new connection) on every edit. Caching the instance on
 * `globalThis` keeps exactly one alive across reloads. In production the module
 * is evaluated once, so the global is never used.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
