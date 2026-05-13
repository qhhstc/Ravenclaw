import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { codeFromName, countrySeeds, currencySeeds, exchangeRateSeeds, platformTypes } from "./helpers";

export async function seedProd(prisma: PrismaClient) {
  const userSeeds = [
    { email: "admin@example.com", password: "admin123456", name: "Admin", role: "admin" },
  ];

  const users = await Promise.all(
    userSeeds.map(async (seed) => {
      const passwordHash = await bcrypt.hash(seed.password, 10);
      return prisma.user.upsert({
        where: { email: seed.email },
        update: { name: seed.name, role: seed.role, status: "active", passwordHash },
        create: { email: seed.email, passwordHash, name: seed.name, role: seed.role, status: "active" },
      });
    }),
  );

  const brandSeeds = ["默认品牌"];
  const brands = await Promise.all(
    brandSeeds.map((name) =>
      prisma.brand.upsert({
        where: { code: codeFromName(name) },
        update: { name, status: "active" },
        create: { name, code: codeFromName(name), website: null, defaultCurrency: "CNY", status: "active" },
      }),
    ),
  );
  const brandMap = Object.fromEntries(brands.map((brand) => [brand.name, brand]));

  const platforms = await Promise.all(
    Object.keys(platformTypes).map((name) =>
      prisma.platform.upsert({
        where: { code: codeFromName(name) },
        update: { name, type: platformTypes[name], status: "active" },
        create: { name, code: codeFromName(name), type: platformTypes[name], status: "active" },
      }),
    ),
  );
  const platformMap = Object.fromEntries(platforms.map((platform) => [platform.name, platform]));

  const storeSeeds = [
    { name: "默认店铺/站点", brand: "默认品牌", platform: "Manual", storeType: "manual_store", marketScope: "global", primaryMarketCode: "US", defaultCurrency: "USD", settlementCurrency: "USD" },
  ];

  const stores = await Promise.all(
    storeSeeds.map((store) =>
      prisma.store.upsert({
        where: { name: store.name },
        update: {
          brandId: brandMap[store.brand].id,
          platformId: platformMap[store.platform].id,
          domain: null,
          storeType: store.storeType,
          marketScope: store.marketScope,
          primaryMarketCode: store.primaryMarketCode,
          defaultCurrency: store.defaultCurrency,
          settlementCurrency: store.settlementCurrency,
          manager: "Admin",
          status: "active",
          remark: null,
        },
        create: {
          brandId: brandMap[store.brand].id,
          platformId: platformMap[store.platform].id,
          name: store.name,
          domain: null,
          storeType: store.storeType,
          marketScope: store.marketScope,
          primaryMarketCode: store.primaryMarketCode,
          defaultCurrency: store.defaultCurrency,
          settlementCurrency: store.settlementCurrency,
          manager: "Admin",
          status: "active",
          remark: null,
        },
      }),
    ),
  );
  const storeMap = Object.fromEntries(stores.map((store) => [store.name, store]));

  const channelSeeds = [
    { businessLine: "默认业务线", platform: "Manual", store: "默认店铺/站点", channelGroup: "默认渠道", channelName: "默认渠道", channelType: "manual" },
  ];

  for (const [index, channel] of channelSeeds.entries()) {
    const store = channel.store ? storeMap[channel.store] : null;
    const platform = platformMap[channel.platform];
    const existing = await prisma.channel.findFirst({ where: { businessLine: channel.businessLine, channelName: channel.channelName, storeId: store?.id ?? null } });
    const data = {
      brandId: store?.brandId ?? brandMap["默认品牌"].id,
      platformId: platform.id,
      storeId: store?.id ?? null,
      channelGroup: channel.channelGroup,
      channelType: channel.channelType,
      sortOrder: index + 1,
      status: "active",
    };
    if (existing) await prisma.channel.update({ where: { id: existing.id }, data });
    else await prisma.channel.create({ data: { ...data, businessLine: channel.businessLine, channelName: channel.channelName } });
  }

  await Promise.all(currencySeeds.map((currency) => prisma.currency.upsert({ where: { code: currency.code }, update: { ...currency, status: "active" }, create: { ...currency, status: "active" } })));
  await Promise.all(countrySeeds.map((country) => prisma.country.upsert({ where: { code: country.code }, update: { ...country, status: "active" }, create: { ...country, status: "active" } })));

  const rateDate = new Date("2026-05-01T00:00:00.000Z");
  await Promise.all(
    exchangeRateSeeds.map((rate) =>
      prisma.exchangeRate.upsert({
        where: { baseCurrency_targetCurrency_rateDate: { baseCurrency: rate.baseCurrency, targetCurrency: rate.targetCurrency, rateDate } },
        update: { rate: rate.rate },
        create: { ...rate, rateDate },
      }),
    ),
  );

  const vendorSeeds = [
    { name: "默认产品供应商", vendorType: "supplier", countryCode: "CN", status: "active", remark: "正式环境基础供应商，可按实际业务修改。" },
    { name: "默认物流服务商", vendorType: "logistics", countryCode: "CN", status: "active", remark: "正式环境基础物流商，可按实际业务修改。" },
    { name: "默认服务商", vendorType: "service", countryCode: "CN", status: "active", remark: "正式环境基础服务商，可按实际业务修改。" },
  ];
  await Promise.all(
    vendorSeeds.map((vendor) =>
      prisma.vendor.upsert({
        where: { name: vendor.name },
        update: vendor,
        create: vendor,
      }),
    ),
  );

  console.log(`Prod seed completed. Admin user: ${users[0].email}. No demo customers/orders/products were created.`);
}
