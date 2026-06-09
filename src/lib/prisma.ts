import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const rawDatabaseUrl =
  process.env.DATABASE_URL || "mysql://root:password@localhost:3306/cross_border_data_center";

function withDefaultMariaDbOptions(url: string) {
  try {
    const parsedUrl = new URL(url);
    const isMariaDbCompatible = parsedUrl.protocol === "mysql:" || parsedUrl.protocol === "mariadb:";
    const hasPublicKeyOption =
      parsedUrl.searchParams.has("allowPublicKeyRetrieval") ||
      parsedUrl.searchParams.has("cachingRsaPublicKey");

    if (isMariaDbCompatible && !hasPublicKeyOption) {
      parsedUrl.searchParams.set("allowPublicKeyRetrieval", "true");
    }

    return parsedUrl.toString();
  } catch {
    return url;
  }
}

const databaseUrl = withDefaultMariaDbOptions(rawDatabaseUrl);

const adapter = new PrismaMariaDb(databaseUrl);

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
