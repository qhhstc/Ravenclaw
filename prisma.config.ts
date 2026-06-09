import "dotenv/config";
import { defineConfig, env } from "prisma/config";

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

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: withDefaultMariaDbOptions(env("DATABASE_URL")),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
