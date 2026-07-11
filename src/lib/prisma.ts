import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  const adapter = new PrismaLibSql({
    url: databaseUrl || "file:./prisma/dev.db",
    authToken: process.env.DATABASE_AUTH_TOKEN?.trim(),
  });
  const client = new PrismaClient({
    adapter,
    log: process.env.PRISMA_QUERY_LOG ? [{ emit: "event", level: "query" }] : [],
  });
  if (process.env.PRISMA_QUERY_LOG) {
    (client as unknown as { $on: (e: string, cb: (ev: { query: string; duration: number }) => void) => void }).$on(
      "query",
      (e) => console.log(`[q ${e.duration}ms]`, e.query.slice(0, 110)),
    );
  }
  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
