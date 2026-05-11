import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const databaseUrl =
  process.env.DATABASE_URL || "mysql://root:password@localhost:3306/cross_border_data_center";
const adapter = new PrismaMariaDb(databaseUrl);
const prisma = new PrismaClient({ adapter });

const platformTypes: Record<string, string> = {
  Amazon: "marketplace",
  Shopify: "independent_site",
  WordPress: "wholesale_site",
  TikTok: "social_commerce",
  "Meta Ads": "advertising",
  "Google Ads": "advertising",
  SEO: "organic",
  EDM: "email",
  Influencer: "influencer",
  Manual: "manual",
};

function codeFromName(name: string) {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

async function main() {
  const passwordHash = await bcrypt.hash("admin123456", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      name: "Admin",
      role: "admin",
      status: "active",
      passwordHash,
    },
    create: {
      email: "admin@example.com",
      passwordHash,
      name: "Admin",
      role: "admin",
      status: "active",
    },
  });

  const brands = await Promise.all(
    ["CALEMBOU", "BAHOMU", "WagEver"].map((name) =>
      prisma.brand.upsert({
        where: { code: codeFromName(name) },
        update: { name, status: "active" },
        create: {
          name,
          code: codeFromName(name),
          website: name === "BAHOMU" ? "https://bahomu.com" : null,
          defaultCurrency: "CNY",
          status: "active",
        },
      }),
    ),
  );

  const brandMap = Object.fromEntries(brands.map((brand) => [brand.name, brand]));

  const platforms = await Promise.all(
    Object.keys(platformTypes).map((name) =>
      prisma.platform.upsert({
        where: { code: codeFromName(name) },
        update: { name, type: platformTypes[name], status: "active" },
        create: {
          name,
          code: codeFromName(name),
          type: platformTypes[name],
          status: "active",
        },
      }),
    ),
  );

  const platformMap = Object.fromEntries(platforms.map((platform) => [platform.name, platform]));

  const storeSeeds = [
    { name: "CALEMBOU-US", brand: "CALEMBOU", platform: "Amazon", country: "US", currency: "USD", type: "Amazon Store" },
    { name: "BAHOMU-US", brand: "BAHOMU", platform: "Amazon", country: "US", currency: "USD", type: "Amazon Store" },
    { name: "BAHOMU-JP", brand: "BAHOMU", platform: "Amazon", country: "JP", currency: "JPY", type: "Amazon Store" },
    { name: "bahomu.com", brand: "BAHOMU", platform: "Shopify", country: "US", currency: "USD", type: "DTC Site", domain: "bahomu.com" },
    { name: "blindboxwholesale.com", brand: "BAHOMU", platform: "WordPress", country: "US", currency: "USD", type: "Wholesale Site", domain: "blindboxwholesale.com" },
    { name: "TikTok Shop US", brand: "BAHOMU", platform: "TikTok", country: "US", currency: "USD", type: "TikTok Shop" },
  ];

  const stores = await Promise.all(
    storeSeeds.map((store) =>
      prisma.store.upsert({
        where: { name: store.name },
        update: {
          brandId: brandMap[store.brand].id,
          platformId: platformMap[store.platform].id,
          domain: store.domain ?? null,
          marketCountry: store.country,
          currency: store.currency,
          businessType: store.type,
          manager: "Admin",
          status: "active",
        },
        create: {
          brandId: brandMap[store.brand].id,
          platformId: platformMap[store.platform].id,
          name: store.name,
          domain: store.domain ?? null,
          marketCountry: store.country,
          currency: store.currency,
          businessType: store.type,
          manager: "Admin",
          status: "active",
        },
      }),
    ),
  );

  const storeMap = Object.fromEntries(stores.map((store) => [store.name, store]));

  const channelSeeds = [
    { businessLine: "Amazon", platform: "Amazon", store: "CALEMBOU-US", channelGroup: "Amazon", channelName: "店铺整体", channelType: "store" },
    { businessLine: "Amazon", platform: "Amazon", store: "BAHOMU-JP", channelGroup: "Amazon", channelName: "店铺整体", channelType: "store" },
    { businessLine: "Shopify独立站", platform: "Shopify", store: "bahomu.com", channelGroup: "Shopify", channelName: "店铺整体", channelType: "store" },
    { businessLine: "WordPress批发", platform: "WordPress", store: "blindboxwholesale.com", channelGroup: "SEO", channelName: "Google SEO", channelType: "organic" },
    { businessLine: "WordPress批发", platform: "WordPress", store: "blindboxwholesale.com", channelGroup: "Google Ads", channelName: "Google Ads", channelType: "paid_ads" },
    { businessLine: "TikTok", platform: "TikTok", store: "TikTok Shop US", channelGroup: "TikTok", channelName: "TT Shop达人", channelType: "influencer" },
    { businessLine: "红人/达人", platform: "Influencer", channelGroup: "Instagram", channelName: "红人合作", channelType: "influencer" },
    { businessLine: "独立站", platform: "EDM", channelGroup: "EDM", channelName: "老客邮件", channelType: "email" },
  ];

  for (const [index, channel] of channelSeeds.entries()) {
    const store = channel.store ? storeMap[channel.store] : null;
    const platform = platformMap[channel.platform];
    const brandId = store?.brandId ?? brandMap.BAHOMU.id;
    const existing = await prisma.channel.findFirst({
      where: {
        businessLine: channel.businessLine,
        channelName: channel.channelName,
        storeId: store?.id ?? null,
      },
    });

    if (existing) {
      await prisma.channel.update({
        where: { id: existing.id },
        data: {
          brandId,
          platformId: platform.id,
          storeId: store?.id ?? null,
          channelGroup: channel.channelGroup,
          channelType: channel.channelType,
          sortOrder: index + 1,
          status: "active",
        },
      });
    } else {
      await prisma.channel.create({
        data: {
          brandId,
          platformId: platform.id,
          storeId: store?.id ?? null,
          businessLine: channel.businessLine,
          channelGroup: channel.channelGroup,
          channelName: channel.channelName,
          channelType: channel.channelType,
          sortOrder: index + 1,
          status: "active",
        },
      });
    }
  }

  const currencies = [
    { code: "USD", name: "US Dollar", symbol: "$" },
    { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
    { code: "JPY", name: "Japanese Yen", symbol: "¥" },
    { code: "EUR", name: "Euro", symbol: "€" },
    { code: "GBP", name: "British Pound", symbol: "£" },
  ];

  await Promise.all(
    currencies.map((currency) =>
      prisma.currency.upsert({
        where: { code: currency.code },
        update: { ...currency, status: "active" },
        create: { ...currency, status: "active" },
      }),
    ),
  );

  const countries = [
    { code: "US", name: "United States", region: "North America" },
    { code: "CN", name: "China", region: "Asia" },
    { code: "JP", name: "Japan", region: "Asia" },
    { code: "DE", name: "Germany", region: "Europe" },
    { code: "GB", name: "United Kingdom", region: "Europe" },
  ];

  await Promise.all(
    countries.map((country) =>
      prisma.country.upsert({
        where: { code: country.code },
        update: { ...country, status: "active" },
        create: { ...country, status: "active" },
      }),
    ),
  );

  const rateDate = new Date("2026-05-01T00:00:00.000Z");
  const rates = [
    { baseCurrency: "USD", targetCurrency: "CNY", rate: 7.1 },
    { baseCurrency: "JPY", targetCurrency: "CNY", rate: 0.047 },
    { baseCurrency: "EUR", targetCurrency: "CNY", rate: 7.7 },
    { baseCurrency: "GBP", targetCurrency: "CNY", rate: 8.95 },
  ];

  await Promise.all(
    rates.map((rate) =>
      prisma.exchangeRate.upsert({
        where: {
          baseCurrency_targetCurrency_rateDate: {
            baseCurrency: rate.baseCurrency,
            targetCurrency: rate.targetCurrency,
            rateDate,
          },
        },
        update: { rate: rate.rate },
        create: {
          ...rate,
          rateDate,
        },
      }),
    ),
  );

  console.log(`Seed completed. Admin user: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
