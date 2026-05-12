import { createSeedClient } from "./helpers";
import { seedDemo } from "./demo";
import { seedProd } from "./prod";

const seedMode = (process.env.SEED_MODE || "prod").toLowerCase();
const prisma = createSeedClient();

async function main() {
  if (seedMode === "demo") {
    await seedDemo(prisma);
    return;
  }

  if (seedMode === "prod") {
    await seedProd(prisma);
    return;
  }

  throw new Error(`Unsupported SEED_MODE: ${seedMode}. Use SEED_MODE=prod or SEED_MODE=demo.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
