import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const platformTypes: Record<string, string> = {
  Amazon: "marketplace",
  Shopify: "independent_site",
  WordPress: "wholesale_site",
  TikTok: "social",
  "Meta Ads": "ads",
  "Google Ads": "ads",
  SEO: "organic",
  EDM: "email",
  Influencer: "influencer",
  Manual: "manual",
};

function codeFromName(name: string) {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function quarterFromMonth(month: number) {
  return Math.ceil(month / 3);
}

function money(value: number) {
  return Number(value.toFixed(2));
}

function orderPaymentStatus(totalAmount: number, paidAmount: number, orderStatus?: string) {
  if (orderStatus === "refunded") return "refunded";
  if (paidAmount <= 0) return "unpaid";
  if (paidAmount < totalAmount) return "partial_paid";
  return "paid";
}

function orderGrossMargin(salesAmount: number, grossProfit: number) {
  return salesAmount > 0 ? Number((grossProfit / salesAmount).toFixed(4)) : null;
}

function productCost(items: Array<{ quantity: number; purchaseUnitCost: number }>) {
  return money(items.reduce((sum, item) => sum + item.quantity * item.purchaseUnitCost, 0));
}

function packagingCost(items: Array<{ quantity: number; packagingUnitCost: number }>) {
  return money(items.reduce((sum, item) => sum + item.quantity * item.packagingUnitCost, 0));
}

export async function seedDemo(prisma: PrismaClient) {
  const userSeeds = [
    { email: "admin@example.com", password: "admin123456", name: "Admin", role: "admin" },
    { email: "sales1@example.com", password: "sales123456", name: "Sales 1", role: "sales" },
    { email: "sales2@example.com", password: "sales123456", name: "Sales 2", role: "sales" },
    { email: "finance@example.com", password: "finance123456", name: "Finance", role: "finance" },
  ];

  const users = await Promise.all(
    userSeeds.map(async (seed) => {
      const passwordHash = await bcrypt.hash(seed.password, 10);
      return prisma.user.upsert({
        where: { email: seed.email },
        update: {
          name: seed.name,
          role: seed.role,
          status: "active",
          passwordHash,
        },
        create: {
          email: seed.email,
          passwordHash,
          name: seed.name,
          role: seed.role,
          status: "active",
        },
      });
    }),
  );

  const userMap = Object.fromEntries(users.map((user) => [user.email, user]));
  const admin = userMap["admin@example.com"];
  const sales1 = userMap["sales1@example.com"];
  const sales2 = userMap["sales2@example.com"];

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
    {
      name: "CALEMBOU-US",
      brand: "CALEMBOU",
      platform: "Amazon",
      storeType: "amazon_store",
      marketScope: "single_market",
      primaryMarketCode: "US",
      defaultCurrency: "USD",
      settlementCurrency: "USD",
    },
    {
      name: "BAHOMU-US",
      brand: "BAHOMU",
      platform: "Amazon",
      storeType: "amazon_store",
      marketScope: "single_market",
      primaryMarketCode: "US",
      defaultCurrency: "USD",
      settlementCurrency: "USD",
    },
    {
      name: "BAHOMU-JP",
      brand: "BAHOMU",
      platform: "Amazon",
      storeType: "amazon_store",
      marketScope: "single_market",
      primaryMarketCode: "JP",
      defaultCurrency: "JPY",
      settlementCurrency: "JPY",
    },
    {
      name: "bahomu.com",
      brand: "BAHOMU",
      platform: "Shopify",
      domain: "bahomu.com",
      storeType: "shopify_dtc_site",
      marketScope: "global",
      primaryMarketCode: "US",
      defaultCurrency: "USD",
      settlementCurrency: "USD",
    },
    {
      name: "blindboxwholesale.com",
      brand: "BAHOMU",
      platform: "WordPress",
      domain: "blindboxwholesale.com",
      storeType: "wordpress_wholesale_site",
      marketScope: "global",
      primaryMarketCode: "US",
      defaultCurrency: "USD",
      settlementCurrency: "USD",
    },
    {
      name: "TikTok Shop US",
      brand: "BAHOMU",
      platform: "TikTok",
      storeType: "tiktok_shop",
      marketScope: "single_market",
      primaryMarketCode: "US",
      defaultCurrency: "USD",
      settlementCurrency: "USD",
    },
  ];

  const stores = await Promise.all(
    storeSeeds.map((store) =>
      prisma.store.upsert({
        where: { name: store.name },
        update: {
          brandId: brandMap[store.brand].id,
          platformId: platformMap[store.platform].id,
          domain: store.domain ?? null,
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
          domain: store.domain ?? null,
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

  const existingMetaAdsChannel = await prisma.channel.findFirst({
    where: {
      businessLine: "Meta Ads",
      channelName: "Meta Ads",
      storeId: null,
    },
  });

  if (existingMetaAdsChannel) {
    await prisma.channel.update({
      where: { id: existingMetaAdsChannel.id },
      data: {
        brandId: brandMap.BAHOMU.id,
        platformId: platformMap["Meta Ads"].id,
        channelGroup: "Meta Ads",
        channelType: "paid_ads",
        sortOrder: 90,
        status: "inactive",
      },
    });
  } else {
    await prisma.channel.create({
      data: {
        brandId: brandMap.BAHOMU.id,
        platformId: platformMap["Meta Ads"].id,
        businessLine: "Meta Ads",
        channelGroup: "Meta Ads",
        channelName: "Meta Ads",
        channelType: "paid_ads",
        sortOrder: 90,
        status: "inactive",
      },
    });
  }

  const seededChannels = await prisma.channel.findMany({
    include: {
      brand: true,
      platform: true,
      store: true,
    },
  });

  const findSeededChannel = (businessLine: string, channelName: string, storeName?: string) => {
    const channel = seededChannels.find(
      (item) =>
        item.businessLine === businessLine &&
        item.channelName === channelName &&
        (storeName ? item.store?.name === storeName : !item.storeId),
    );

    if (!channel) {
      throw new Error(`Channel seed missing: ${businessLine} / ${storeName ?? "-"} / ${channelName}`);
    }

    return channel;
  };

  const metricSeeds = [
    {
      channel: findSeededChannel("Amazon", "店铺整体", "CALEMBOU-US"),
      weeks: [
        [265200, 54400],
        [276800, 56100],
        [312400, 63800],
        [360700, 70900],
        [0, 0],
      ],
    },
    {
      channel: findSeededChannel("Amazon", "店铺整体", "BAHOMU-JP"),
      weeks: [
        [68000, 6800],
        [72300, 7100],
        [69900, 6900],
        [71800, 7300],
        [0, 0],
      ],
    },
    {
      channel: findSeededChannel("Shopify独立站", "店铺整体", "bahomu.com"),
      weeks: [
        [212400, 38600],
        [198700, 33400],
        [186300, 32100],
        [167600, 29800],
        [0, 0],
      ],
    },
    {
      channel: findSeededChannel("WordPress批发", "Google SEO", "blindboxwholesale.com"),
      weeks: [
        [98600, 0],
        [103200, 0],
        [92500, 0],
        [88300, 0],
        [0, 0],
      ],
    },
    {
      channel: findSeededChannel("WordPress批发", "Google Ads", "blindboxwholesale.com"),
      weeks: [
        [10799, 4235],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
      ],
    },
    {
      channel: findSeededChannel("TikTok", "TT Shop达人", "TikTok Shop US"),
      weeks: [
        [74600, 9800],
        [71400, 9200],
        [68900, 8700],
        [66400, 8500],
        [0, 0],
      ],
    },
    {
      channel: findSeededChannel("红人/达人", "红人合作"),
      weeks: [
        [39800, 4100],
        [42300, 4300],
        [38600, 3900],
        [41200, 4200],
        [0, 0],
      ],
    },
    {
      channel: findSeededChannel("独立站", "老客邮件"),
      weeks: [
        [9173, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
      ],
    },
  ];

  for (const metricSeed of metricSeeds) {
    const channel = metricSeed.channel;
    const currency = channel.store?.defaultCurrency ?? channel.brand?.defaultCurrency ?? "CNY";
    const countryCode = channel.store?.primaryMarketCode ?? null;

    for (const [weekIndex, [salesAmount, adSpend]] of metricSeed.weeks.entries()) {
      const weekNumber = weekIndex + 1;
      await prisma.channelMetricPeriod.upsert({
        where: {
          year_month_periodType_weekNumber_channelId: {
            year: 2026,
            month: 5,
            periodType: "week",
            weekNumber,
            channelId: channel.id,
          },
        },
        update: {
          brandId: channel.brandId ?? brandMap.BAHOMU.id,
          platformId: channel.platformId ?? platformMap.Manual.id,
          storeId: channel.storeId,
          countryCode,
          currency,
          salesAmountOriginal: salesAmount,
          adSpendOriginal: adSpend,
          refundAmountOriginal: 0,
          exchangeRate: 1,
          salesAmountBase: salesAmount,
          adSpendBase: adSpend,
          refundAmountBase: 0,
          createdBy: admin.id,
          remark: null,
        },
        create: {
          year: 2026,
          month: 5,
          quarter: quarterFromMonth(5),
          weekNumber,
          periodType: "week",
          brandId: channel.brandId ?? brandMap.BAHOMU.id,
          platformId: channel.platformId ?? platformMap.Manual.id,
          storeId: channel.storeId,
          channelId: channel.id,
          countryCode,
          currency,
          salesAmountOriginal: salesAmount,
          adSpendOriginal: adSpend,
          refundAmountOriginal: 0,
          exchangeRate: 1,
          salesAmountBase: salesAmount,
          adSpendBase: adSpend,
          refundAmountBase: 0,
          createdBy: admin.id,
          remark: null,
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
    { code: "UK", name: "United Kingdom", region: "Europe" },
    { code: "CA", name: "Canada", region: "North America" },
    { code: "AU", name: "Australia", region: "Oceania" },
    { code: "FR", name: "France", region: "Europe" },
    { code: "DE", name: "Germany", region: "Europe" },
    { code: "NL", name: "Netherlands", region: "Europe" },
    { code: "KR", name: "South Korea", region: "Asia" },
    { code: "AE", name: "United Arab Emirates", region: "Middle East" },
    { code: "SG", name: "Singapore", region: "Asia" },
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

  await prisma.customer.deleteMany();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const atHour = (dayOffset: number, hour = 10) => {
    const date = new Date(startOfToday);
    date.setDate(date.getDate() + dayOffset);
    date.setHours(hour, 0, 0, 0);
    return date;
  };

  const sourceChannelMap = {
    calembouAmazon: findSeededChannel("Amazon", "店铺整体", "CALEMBOU-US"),
    bahomuJapan: findSeededChannel("Amazon", "店铺整体", "BAHOMU-JP"),
    shopify: findSeededChannel("Shopify独立站", "店铺整体", "bahomu.com"),
    googleSeo: findSeededChannel("WordPress批发", "Google SEO", "blindboxwholesale.com"),
    googleAds: findSeededChannel("WordPress批发", "Google Ads", "blindboxwholesale.com"),
    tiktok: findSeededChannel("TikTok", "TT Shop达人", "TikTok Shop US"),
    influencer: findSeededChannel("红人/达人", "红人合作"),
    edm: findSeededChannel("独立站", "老客邮件"),
    metaAds: seededChannels.find((channel) => channel.businessLine === "Meta Ads" && channel.channelName === "Meta Ads"),
  };

  const customerSeeds = [
    {
      name: "Pacific Toy Wholesale LLC",
      companyName: "Pacific Toy Wholesale LLC",
      customerType: "wholesaler",
      countryCode: "US",
      brandId: brandMap.BAHOMU.id,
      sourceChannelId: sourceChannelMap.googleSeo.id,
      status: "negotiating",
      level: "A",
      email: "buyer@pacifictoy.com",
      whatsapp: "+1 213 555 0188",
      website: "pacifictoy.com",
      nextFollowupAt: atHour(0, 10),
      tags: ["批发", "盲盒", "高意向"],
      remark: "美国西海岸玩具批发客户，重点关注盲盒复购计划。",
      contact: { name: "Emily Carter", position: "Purchasing Manager", email: "buyer@pacifictoy.com", whatsapp: "+1 213 555 0188" },
      followups: [
        { followupType: "email", content: "发送 2026 Q2 盲盒批发目录和阶梯报价。", result: "客户对 24pcs display box 感兴趣。", nextFollowupAt: atHour(0, 10), daysAgo: 2 },
      ],
    },
    {
      name: "Sakura Collectibles Co.",
      companyName: "Sakura Collectibles Co.",
      customerType: "distributor",
      countryCode: "JP",
      brandId: brandMap.BAHOMU.id,
      sourceChannelId: sourceChannelMap.bahomuJapan.id,
      status: "contacted",
      level: "B",
      email: "contact@sakura-collectibles.jp",
      nextFollowupAt: atHour(1, 14),
      tags: ["日本", "分销商"],
      contact: { name: "Haruka Sato", position: "Buyer", email: "contact@sakura-collectibles.jp" },
      followups: [
        { followupType: "email", content: "确认日本渠道分销 MOQ 和可售 SKU。", result: "等待客户提供采购清单。", nextFollowupAt: atHour(1, 14), daysAgo: 1 },
      ],
    },
    {
      name: "MiniJoy Retail Ltd",
      companyName: "MiniJoy Retail Ltd",
      customerType: "company",
      countryCode: "UK",
      brandId: brandMap.BAHOMU.id,
      sourceChannelId: sourceChannelMap.shopify.id,
      status: "quoted",
      level: "B",
      email: "hello@minijoyretail.co.uk",
      website: "minijoyretail.co.uk",
      nextFollowupAt: atHour(3, 11),
      tags: ["英国", "礼品店"],
      contact: { name: "Oliver Reed", position: "Founder", email: "hello@minijoyretail.co.uk" },
      followups: [
        { followupType: "whatsapp", content: "已发送礼品店定制报价。", result: "客户内部评估中。", nextFollowupAt: atHour(3, 11), daysAgo: 3 },
      ],
    },
    {
      name: "Bright Panda Gifts",
      companyName: "Bright Panda Gifts",
      customerType: "wholesaler",
      countryCode: "CA",
      brandId: brandMap.CALEMBOU.id,
      sourceChannelId: sourceChannelMap.googleAds.id,
      status: "new",
      level: "C",
      email: "sales@brightpandagifts.ca",
      nextFollowupAt: atHour(-2, 9),
      tags: ["加拿大", "待确认"],
      contact: { name: "Ava Wilson", position: "Sales Lead", email: "sales@brightpandagifts.ca" },
      followups: [
        { followupType: "note", content: "客户通过广告表单留下需求，需确认品类和采购周期。", result: "待首次触达。", nextFollowupAt: atHour(-2, 9), daysAgo: 4 },
      ],
    },
    {
      name: "Oceanic Trading Pty",
      companyName: "Oceanic Trading Pty",
      customerType: "distributor",
      countryCode: "AU",
      brandId: brandMap.BAHOMU.id,
      sourceChannelId: sourceChannelMap.edm.id,
      status: "repeat",
      level: "A",
      email: "orders@oceanictrading.com.au",
      nextFollowupAt: atHour(7, 10),
      tags: ["老客户", "复购"],
      contact: { name: "Noah Brown", position: "Account Manager", email: "orders@oceanictrading.com.au" },
      followups: [
        { followupType: "email", content: "复盘上一批发货和新品补货节奏。", result: "客户希望 7 天后确认补货数量。", nextFollowupAt: atHour(7, 10), daysAgo: 5 },
      ],
    },
    {
      name: "Maison & Co",
      companyName: "Maison & Co",
      customerType: "company",
      countryCode: "FR",
      brandId: brandMap.WagEver.id,
      sourceChannelId: sourceChannelMap.googleSeo.id,
      status: "contacted",
      level: "C",
      email: "bonjour@maisonco.fr",
      nextFollowupAt: atHour(-5, 15),
      tags: ["欧洲", "宠物纪念"],
      contact: { name: "Camille Laurent", position: "Merchandiser", email: "bonjour@maisonco.fr" },
      followups: [
        { followupType: "email", content: "介绍 WagEver 宠物纪念产品线。", result: "客户要求补充材质说明。", nextFollowupAt: atHour(-5, 15), daysAgo: 8 },
      ],
    },
    {
      name: "Urban Anime Store",
      companyName: "Urban Anime Store",
      customerType: "wholesaler",
      countryCode: "US",
      brandId: brandMap.BAHOMU.id,
      sourceChannelId: sourceChannelMap.tiktok.id,
      status: "negotiating",
      level: "A",
      email: "buying@urbananime.store",
      whatsapp: "+1 646 555 0199",
      nextFollowupAt: atHour(0, 16),
      tags: ["动漫", "美国"],
      contact: { name: "Mason Lee", position: "Owner", email: "buying@urbananime.store", whatsapp: "+1 646 555 0199" },
      followups: [
        { followupType: "phone", content: "沟通 TikTok 爆品款式和门店陈列需求。", result: "客户希望今天确认首单数量。", nextFollowupAt: atHour(0, 16), daysAgo: 1 },
      ],
    },
    {
      name: "Luna Creator Studio",
      companyName: "Luna Creator Studio",
      customerType: "influencer",
      countryCode: "US",
      brandId: brandMap.BAHOMU.id,
      sourceChannelId: sourceChannelMap.influencer.id,
      status: "contacted",
      level: "B",
      email: "luna@creatorstudio.example",
      nextFollowupAt: atHour(4, 13),
      tags: ["红人", "Instagram"],
      contact: { name: "Luna Martinez", position: "Creator", email: "luna@creatorstudio.example" },
      followups: [
        { followupType: "whatsapp", content: "确认 Instagram 内容合作报价和样品寄送地址。", result: "等待档期反馈。", nextFollowupAt: atHour(4, 13), daysAgo: 2 },
      ],
    },
    {
      name: "Nordic Gift House",
      companyName: "Nordic Gift House",
      customerType: "distributor",
      countryCode: "DE",
      brandId: brandMap.CALEMBOU.id,
      sourceChannelId: sourceChannelMap.googleSeo.id,
      status: "lost",
      level: "D",
      email: "info@nordicgifthouse.de",
      nextFollowupAt: null,
      tags: ["德国", "已流失"],
      contact: { name: "Lukas Weber", position: "Director", email: "info@nordicgifthouse.de" },
    },
    {
      name: "HappyKids Store",
      companyName: "HappyKids Store",
      customerType: "company",
      countryCode: "US",
      brandId: brandMap.BAHOMU.id,
      sourceChannelId: sourceChannelMap.metaAds?.id,
      status: "won",
      level: "A",
      email: "team@happykidsstore.com",
      nextFollowupAt: atHour(15, 10),
      tags: ["已成交", "玩具店"],
      contact: { name: "Sophia Johnson", position: "Buyer", email: "team@happykidsstore.com" },
      followups: [
        { followupType: "email", content: "确认首单已成交后的补货计划。", result: "15 天后同步销售反馈。", nextFollowupAt: atHour(15, 10), daysAgo: 3 },
      ],
    },
    {
      name: "Blue Whale Imports",
      companyName: "Blue Whale Imports",
      customerType: "wholesaler",
      countryCode: "NL",
      brandId: brandMap.BAHOMU.id,
      sourceChannelId: sourceChannelMap.googleSeo.id,
      status: "quoted",
      level: "B",
      email: "purchase@bluewhaleimports.nl",
      nextFollowupAt: atHour(2, 10),
      tags: ["荷兰", "批发"],
      contact: { name: "Daan Visser", position: "Purchasing", email: "purchase@bluewhaleimports.nl" },
    },
    {
      name: "Green Pet Memories",
      companyName: "Green Pet Memories",
      customerType: "company",
      countryCode: "US",
      brandId: brandMap.WagEver.id,
      sourceChannelId: sourceChannelMap.googleSeo.id,
      status: "new",
      level: "C",
      email: "hello@greenpetmemories.com",
      website: "greenpetmemories.com",
      nextFollowupAt: atHour(1, 9),
      tags: ["宠物纪念", "美国"],
      contact: { name: "Grace Miller", position: "Founder", email: "hello@greenpetmemories.com" },
    },
  ];

  for (const seed of customerSeeds) {
    const lastFollowupAt = seed.followups?.length ? atHour(-(seed.followups[0].daysAgo ?? 1), 16) : null;
    const customer = await prisma.customer.create({
      data: {
        name: seed.name,
        companyName: seed.companyName,
        customerType: seed.customerType,
        countryCode: seed.countryCode,
        email: seed.email ?? null,
        phone: null,
        whatsapp: seed.whatsapp ?? null,
        website: seed.website ?? null,
        sourceChannelId: seed.sourceChannelId ?? null,
        brandId: seed.brandId,
        ownerId: admin.id,
        level: seed.level,
        status: seed.status,
        tags: seed.tags,
        remark: seed.remark ?? null,
        lastFollowupAt,
        nextFollowupAt: seed.nextFollowupAt,
        contacts: {
          create: {
            ...seed.contact,
            isPrimary: true,
          },
        },
      },
    });

    for (const followup of seed.followups ?? []) {
      await prisma.customerFollowup.create({
        data: {
          customerId: customer.id,
          followupType: followup.followupType,
          content: followup.content,
          result: followup.result,
          nextFollowupAt: followup.nextFollowupAt,
          ownerId: admin.id,
          createdAt: atHour(-followup.daysAgo, 16),
        },
      });
    }
  }


  const customerList = await prisma.customer.findMany();
  const customerMap = Object.fromEntries(customerList.map((customer) => [customer.name, customer]));

  const extraCustomerSeeds = [
    {
      name: "Seoul Pop Mart Reseller",
      companyName: "Seoul Pop Mart Reseller",
      customerType: "distributor",
      countryCode: "KR",
      brandId: brandMap.BAHOMU.id,
      sourceChannelId: sourceChannelMap.googleSeo.id,
      status: "quoted",
      level: "B",
      email: "sales@seoulpopmart.kr",
      tags: ["韩国", "报价客户"],
      contact: { name: "Minseo Kim", position: "Owner", email: "sales@seoulpopmart.kr" },
    },
    {
      name: "Dubai Gift Trading",
      companyName: "Dubai Gift Trading",
      customerType: "wholesaler",
      countryCode: "AE",
      brandId: brandMap.BAHOMU.id,
      sourceChannelId: sourceChannelMap.googleSeo.id,
      status: "negotiating",
      level: "A",
      email: "buyer@dubaigifttrading.ae",
      tags: ["迪拜", "批发"],
      contact: { name: "Aisha Khan", position: "Buyer", email: "buyer@dubaigifttrading.ae" },
    },
    {
      name: "Singapore Hobby Hub",
      companyName: "Singapore Hobby Hub",
      customerType: "company",
      countryCode: "SG",
      brandId: brandMap.BAHOMU.id,
      sourceChannelId: sourceChannelMap.shopify.id,
      status: "contacted",
      level: "B",
      email: "hello@sghobbyhub.sg",
      tags: ["新加坡", "爱好店"],
      contact: { name: "Ethan Tan", position: "Manager", email: "hello@sghobbyhub.sg" },
    },
  ];

  for (const seed of extraCustomerSeeds) {
    const customer = await prisma.customer.create({
      data: {
        name: seed.name,
        companyName: seed.companyName,
        customerType: seed.customerType,
        countryCode: seed.countryCode,
        email: seed.email,
        sourceChannelId: seed.sourceChannelId,
        brandId: seed.brandId,
        ownerId: admin.id,
        level: seed.level,
        status: seed.status,
        tags: seed.tags,
        contacts: { create: { ...seed.contact, isPrimary: true } },
      },
    });
    customerMap[customer.name] = customer;
  }

  await prisma.attachment.deleteMany();
  await prisma.orderStatusLog.deleteMany();
  await prisma.orderCost.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.inquiry.deleteMany();
  await prisma.product.deleteMany();
  await prisma.vendor.deleteMany();

  const vendorSeeds = [
    { name: "Shenzhen Cross-border Supply Co.", vendorType: "supplier", countryCode: "CN", contact: "Grace", email: "sourcing@example.com", phone: "+86 755 1000 0001", whatsapp: "+86 138 0000 0001", website: "https://supply.example.com" },
    { name: "Dongguan Plush Workshop", vendorType: "supplier", countryCode: "CN", contact: "Leo", email: "leo@plush.example.com", phone: "+86 769 1000 0002" },
    { name: "Yiwu Gift Packaging Co.", vendorType: "supplier", countryCode: "CN", contact: "Amy", email: "amy@yiwugift.example.com", phone: "+86 579 1000 0003" },
    { name: "Guangzhou Acrylic Factory", vendorType: "supplier", countryCode: "CN", contact: "Nina", email: "nina@acrylic.example.com", phone: "+86 20 1000 0004" },
    { name: "Ningbo Port Logistics", vendorType: "logistics", countryCode: "CN", contact: "Mike", email: "ops@nbport.example.com", phone: "+86 574 1000 0005" },
    { name: "DHL Express Service", vendorType: "logistics", countryCode: "DE", contact: "DHL Account", email: "account@dhl.example.com", phone: "+49 1000 0006" },
    { name: "PayPal Payment Service", vendorType: "service", countryCode: "US", contact: "Finance Support", email: "support@paypal.example.com" },
    { name: "Customs Broker Pro", vendorType: "service", countryCode: "US", contact: "Oliver", email: "broker@example.com", phone: "+1 555 0107" },
  ];
  const vendors = await Promise.all(
    vendorSeeds.map((seed) =>
      prisma.vendor.create({
        data: {
          ...seed,
          status: "active",
          remark: "Seed 供应商，用于产品默认供应商与成本验收。",
        },
      }),
    ),
  );
  const vendorMap = Object.fromEntries(vendors.map((vendor) => [vendor.name, vendor]));

  const productSeeds = [
    { sku: "BB-KIMMON-OCEAN", name: "NEW Kimmon Ocean Fridge Magnet Series Plush Blind Box", specification: "9 basic styles + 1 hidden style", category: "盲盒", defaultPurchasePrice: 3.2, defaultPackagingCost: 0.25, brand: "BAHOMU", vendor: "Shenzhen Cross-border Supply Co." },
    { sku: "PLUSH-PANDA-8CM", name: "8cm Panda Plush Toy", specification: "8cm, polyester", category: "毛绒", defaultPurchasePrice: 1.85, defaultPackagingCost: 0.18, brand: "BAHOMU", vendor: "Dongguan Plush Workshop" },
    { sku: "PET-CLOCK-ACRYLIC", name: "Custom Pet Memorial Acrylic Clock", specification: "Custom acrylic", category: "宠物纪念", defaultPurchasePrice: 8.5, defaultPackagingCost: 0.8, brand: "WagEver", vendor: "Guangzhou Acrylic Factory" },
    { sku: "BB-MIX-24", name: "Blind Box Mixed Case", specification: "24pcs display box", category: "盲盒", defaultPurchasePrice: 45, defaultPackagingCost: 2.8, brand: "BAHOMU", vendor: "Shenzhen Cross-border Supply Co." },
    { sku: "BB-WHOLE-12", name: "Wholesale Blind Box Pack", specification: "12 boxes / carton", category: "盲盒", defaultPurchasePrice: 39, defaultPackagingCost: 2.2, brand: "BAHOMU", vendor: "Shenzhen Cross-border Supply Co." },
    { sku: "BHM-GIFT-01", name: "Gift Mystery Box", specification: "Gift bundle with sticker", category: "礼品", defaultPurchasePrice: 42, defaultPackagingCost: 2.4, brand: "BAHOMU", vendor: "Yiwu Gift Packaging Co." },
    { sku: "TT-ANIME-01", name: "TikTok Anime Blind Box", specification: "Anime series mixed", category: "盲盒", defaultPurchasePrice: 46, defaultPackagingCost: 2.5, brand: "BAHOMU", vendor: "Shenzhen Cross-border Supply Co." },
    { sku: "JP-ANIME-01", name: "Anime Collectible Box", specification: "JP exclusive pack", category: "盲盒", defaultPurchasePrice: 36, defaultPackagingCost: 2.1, brand: "BAHOMU", vendor: "Shenzhen Cross-border Supply Co." },
    { sku: "CLB-AMZ-02", name: "Amazon CALEMBOU Set", specification: "Amazon FBA bundle", category: "礼品", defaultPurchasePrice: 54, defaultPackagingCost: 3.5, brand: "CALEMBOU", vendor: "Yiwu Gift Packaging Co." },
    { sku: "PET-FRAME-WOOD", name: "Custom Pet Memorial Wooden Frame", specification: "Custom wood frame", category: "宠物纪念", defaultPurchasePrice: 12.6, defaultPackagingCost: 1.2, brand: "WagEver", vendor: "Guangzhou Acrylic Factory" },
    { sku: "PLUSH-BUNNY-12CM", name: "12cm Bunny Plush Toy", specification: "12cm, soft plush", category: "毛绒", defaultPurchasePrice: 2.4, defaultPackagingCost: 0.22, brand: "BAHOMU", vendor: "Dongguan Plush Workshop" },
    { sku: "GIFT-STICKER-PACK", name: "Cute Gift Sticker Pack", specification: "20 sheets pack", category: "礼品", defaultPurchasePrice: 0.65, defaultPackagingCost: 0.05, brand: "BAHOMU", vendor: "Yiwu Gift Packaging Co." },
  ];

  const products = await Promise.all(
    productSeeds.map((seed) =>
      prisma.product.create({
        data: {
          sku: seed.sku,
          name: seed.name,
          specification: seed.specification,
          category: seed.category,
          defaultPurchasePrice: seed.defaultPurchasePrice,
          defaultPackagingCost: seed.defaultPackagingCost,
          currency: "USD",
          defaultVendorId: vendorMap[seed.vendor].id,
          brandId: brandMap[seed.brand].id,
          status: "active",
          remark: "Seed 产品，用于订单选择产品后自动带出成本。",
        },
      }),
    ),
  );

  const productMap = Object.fromEntries(products.map((product) => [product.sku, product]));

  const quoteSeeds = [
    { quoteNo: "QUO-202605-0001", customer: "Pacific Toy Wholesale LLC", source: sourceChannelMap.googleSeo, status: "converted", items: [["BB-MIX-24", "Blind Box Mixed Case", 40, 80]], shippingFee: 480, discountAmount: 100 },
    { quoteNo: "QUO-202605-0002", customer: "Seoul Pop Mart Reseller", source: sourceChannelMap.googleSeo, status: "converted", items: [["BB-KR-SET", "Korea Reseller Blind Box Set", 60, 90]], shippingFee: 0, discountAmount: 0 },
    { quoteNo: "QUO-202605-0003", customer: "Dubai Gift Trading", source: sourceChannelMap.googleSeo, status: "converted", items: [["BB-ME-42", "Middle East Gift Blind Box", 42, 100]], shippingFee: 0, discountAmount: 0 },
    { quoteNo: "QUO-202605-0004", customer: "Blue Whale Imports", source: sourceChannelMap.googleSeo, status: "converted", items: [["BB-WHOLE-12", "Wholesale Blind Box Pack", 60, 83]], shippingFee: 0, discountAmount: 0 },
    { quoteNo: "QUO-202605-0005", customer: "Sakura Collectibles Co.", source: sourceChannelMap.bahomuJapan, status: "converted", items: [["JP-ANIME-01", "Anime Collectible Box", 24, 82.5]], shippingFee: 320, discountAmount: 100 },
    { quoteNo: "QUO-202605-0006", customer: "Luna Creator Studio", source: sourceChannelMap.influencer, status: "accepted", items: [["INF-SAMPLE", "Influencer Sample Bundle", 8, 120]], shippingFee: 80, discountAmount: 0 },
  ];

  const quoteMap: Record<string, Awaited<ReturnType<typeof prisma.quote.create>>> = {};
  const inquiryMap: Record<string, Awaited<ReturnType<typeof prisma.inquiry.create>>> = {};

  for (const [index, seed] of quoteSeeds.entries()) {
    const customer = customerMap[seed.customer];
    const source = seed.source;
    const productAmount = seed.items.reduce((sum, item) => sum + Number(item[2]) * Number(item[3]), 0);
    const totalAmount = money(productAmount + seed.shippingFee - seed.discountAmount);
    const inquiry = await prisma.inquiry.create({
      data: {
        inquiryNo: `INQ-202605-${String(index + 1).padStart(4, "0")}`,
        customerId: customer?.id,
        brandId: source.brandId ?? brandMap.BAHOMU.id,
        platformId: source.platformId ?? platformMap.Manual.id,
        storeId: source.storeId,
        channelId: source.id,
        countryCode: customer?.countryCode ?? source.store?.primaryMarketCode ?? null,
        status: seed.status === "converted" ? "won" : "negotiating",
        title: `${seed.customer} 报价需求`,
        content: "Seed 报价询盘，用于验证报价转订单流程。",
      },
    });
    const quote = await prisma.quote.create({
      data: {
        quoteNo: seed.quoteNo,
        inquiryId: inquiry.id,
        customerId: customer?.id,
        brandId: inquiry.brandId,
        platformId: inquiry.platformId,
        storeId: inquiry.storeId,
        channelId: inquiry.channelId,
        countryCode: inquiry.countryCode,
        currency: "USD",
        productAmount,
        shippingFee: seed.shippingFee,
        discountAmount: seed.discountAmount,
        taxAmount: 0,
        otherFee: 0,
        totalAmount,
        status: seed.status,
        convertedAt: seed.status === "converted" ? new Date() : null,
        items: {
          create: seed.items.map(([sku, productName, quantity, unitPrice]) => ({
            sku: String(sku),
            productName: String(productName),
            quantity: Number(quantity),
            unitPrice: Number(unitPrice),
            totalPrice: money(Number(quantity) * Number(unitPrice)),
          })),
        },
      },
    });
    quoteMap[seed.quoteNo] = quote;
    inquiryMap[seed.quoteNo] = inquiry;
  }

  const orderDate = (day: number) => new Date(`2026-05-${String(day).padStart(2, "0")}T10:00:00.000Z`);
  const due = (dayOffset: number) => atHour(dayOffset, 18);
  const storeByName = (name: string) => storeMap[name];
  const channelFor = (key: keyof typeof sourceChannelMap) => sourceChannelMap[key];

  type OrderSeedItem = { sku: string; quantity: number; saleUnitPrice: number; purchaseUnitCost?: number; packagingUnitCost?: number; remark?: string };
  type OrderSeed = {
    orderNo: string;
    source: string;
    customer: string | null;
    channel: (typeof seededChannels)[number] | undefined;
    store?: string | null;
    quoteNo?: string;
    countryCode: string;
    paidAmount: number;
    orderStatus: string;
    shippingStatus: string;
    dueDate?: Date | null;
    shipmentDate?: Date | null;
    salespersonId: number;
    items: OrderSeedItem[];
    costs: Record<string, number>;
    remark?: string;
  };

  const costDefaults = {
    domestic_shipping: 0,
    international_shipping: 0,
    customs_fee: 0,
    port_charge: 0,
    trucking_fee: 0,
    platform_fee: 0,
    payment_fee: 0,
    other: 0,
  };

  const orderSeeds: OrderSeed[] = [
    { orderNo: "ORD-202605-0001", source: "quote", customer: "Pacific Toy Wholesale LLC", channel: channelFor("googleSeo"), store: "blindboxwholesale.com", quoteNo: "QUO-202605-0001", countryCode: "US", paidAmount: 1000, orderStatus: "paid", shippingStatus: "unshipped", dueDate: due(-3), salespersonId: sales1.id, items: [{ sku: "BB-MIX-24", quantity: 40, saleUnitPrice: 80 }, { sku: "GIFT-STICKER-PACK", quantity: 80, saleUnitPrice: 1.2 }], costs: { domestic_shipping: 95, international_shipping: 620, customs_fee: 120, port_charge: 65, trucking_fee: 80, payment_fee: 95 } },
    { orderNo: "ORD-202605-0002", source: "shopify", customer: "MiniJoy Retail Ltd", channel: channelFor("shopify"), store: "bahomu.com", countryCode: "UK", paidAmount: 2160, orderStatus: "preparing", shippingStatus: "unshipped", salespersonId: sales1.id, items: [{ sku: "BHM-GIFT-01", quantity: 24, saleUnitPrice: 90 }], costs: { platform_fee: 86, payment_fee: 65, international_shipping: 210 } },
    { orderNo: "ORD-202605-0003", source: "amazon", customer: null, channel: channelFor("bahomuJapan"), store: "BAHOMU-JP", countryCode: "JP", paidAmount: 880, orderStatus: "completed", shippingStatus: "delivered", shipmentDate: orderDate(5), salespersonId: sales2.id, items: [{ sku: "JP-ANIME-01", quantity: 8, saleUnitPrice: 110 }], costs: { platform_fee: 132, international_shipping: 65, payment_fee: 18 } },
    { orderNo: "ORD-202605-0004", source: "amazon", customer: null, channel: channelFor("calembouAmazon"), store: "CALEMBOU-US", countryCode: "US", paidAmount: 1260, orderStatus: "shipped", shippingStatus: "shipped", shipmentDate: orderDate(7), salespersonId: sales2.id, items: [{ sku: "CLB-AMZ-02", quantity: 12, saleUnitPrice: 105 }], costs: { platform_fee: 210, international_shipping: 120, payment_fee: 24 } },
    { orderNo: "ORD-202605-0005", source: "tiktok_shop", customer: "Urban Anime Store", channel: channelFor("tiktok"), store: "TikTok Shop US", countryCode: "US", paidAmount: 0, orderStatus: "pending_payment", shippingStatus: "unshipped", dueDate: due(0), salespersonId: sales1.id, items: [{ sku: "TT-ANIME-01", quantity: 36, saleUnitPrice: 95 }, { sku: "PLUSH-PANDA-8CM", quantity: 120, saleUnitPrice: 3.6 }], costs: { platform_fee: 380, international_shipping: 420, payment_fee: 80, other: 50 } },
    { orderNo: "ORD-202605-0006", source: "manual", customer: "Oceanic Trading Pty", channel: channelFor("edm"), store: null, countryCode: "AU", paidAmount: 6120, orderStatus: "completed", shippingStatus: "delivered", shipmentDate: orderDate(10), salespersonId: sales1.id, items: [{ sku: "BB-KIMMON-OCEAN", quantity: 1200, saleUnitPrice: 4.4 }, { sku: "GIFT-STICKER-PACK", quantity: 800, saleUnitPrice: 1.05 }], costs: { domestic_shipping: 180, international_shipping: 760, customs_fee: 180, port_charge: 90, trucking_fee: 120, payment_fee: 120 } },
    { orderNo: "ORD-202605-0007", source: "wordpress_wholesale", customer: "Blue Whale Imports", channel: channelFor("googleSeo"), store: "blindboxwholesale.com", countryCode: "NL", paidAmount: 1500, orderStatus: "preparing", shippingStatus: "partial_shipped", dueDate: due(5), shipmentDate: orderDate(13), salespersonId: sales2.id, items: [{ sku: "BB-WHOLE-12", quantity: 60, saleUnitPrice: 83 }], costs: { domestic_shipping: 110, international_shipping: 980, customs_fee: 210, port_charge: 95, trucking_fee: 180, payment_fee: 75 } },
    { orderNo: "ORD-202605-0008", source: "shopify", customer: "HappyKids Store", channel: channelFor("shopify"), store: "bahomu.com", countryCode: "US", paidAmount: 780, orderStatus: "completed", shippingStatus: "delivered", shipmentDate: orderDate(11), salespersonId: sales1.id, items: [{ sku: "BHM-GIFT-01", quantity: 6, saleUnitPrice: 130 }, { sku: "PLUSH-BUNNY-12CM", quantity: 40, saleUnitPrice: 4.8 }], costs: { platform_fee: 58, payment_fee: 31, international_shipping: 95 } },
    { orderNo: "ORD-202605-0009", source: "quote", customer: "Seoul Pop Mart Reseller", channel: channelFor("googleSeo"), store: "blindboxwholesale.com", quoteNo: "QUO-202605-0002", countryCode: "KR", paidAmount: 0, orderStatus: "pending_payment", shippingStatus: "unshipped", dueDate: due(-7), salespersonId: sales2.id, items: [{ sku: "BB-KIMMON-OCEAN", quantity: 900, saleUnitPrice: 6 }, { sku: "PLUSH-PANDA-8CM", quantity: 300, saleUnitPrice: 3.5 }], costs: { domestic_shipping: 160, international_shipping: 980, customs_fee: 260, port_charge: 120, trucking_fee: 210, payment_fee: 0 } },
    { orderNo: "ORD-202605-0010", source: "quote", customer: "Dubai Gift Trading", channel: channelFor("googleSeo"), store: "blindboxwholesale.com", quoteNo: "QUO-202605-0003", countryCode: "AE", paidAmount: 2000, orderStatus: "preparing", shippingStatus: "unshipped", dueDate: due(2), salespersonId: sales1.id, items: [{ sku: "BB-MIX-24", quantity: 42, saleUnitPrice: 100 }], costs: { domestic_shipping: 100, international_shipping: 1180, customs_fee: 280, port_charge: 160, trucking_fee: 240, payment_fee: 90 } },
    { orderNo: "ORD-202605-0011", source: "quote", customer: "Blue Whale Imports", channel: channelFor("googleSeo"), store: "blindboxwholesale.com", quoteNo: "QUO-202605-0004", countryCode: "NL", paidAmount: 0, orderStatus: "pending_payment", shippingStatus: "unshipped", dueDate: due(-1), salespersonId: sales2.id, items: [{ sku: "BB-WHOLE-12", quantity: 28, saleUnitPrice: 85 }], costs: { domestic_shipping: 80, international_shipping: 620, customs_fee: 150, port_charge: 65, trucking_fee: 130 } },
    { orderNo: "ORD-202605-0012", source: "quote", customer: "Sakura Collectibles Co.", channel: channelFor("bahomuJapan"), store: "BAHOMU-JP", quoteNo: "QUO-202605-0005", countryCode: "JP", paidAmount: 2200, orderStatus: "shipped", shippingStatus: "shipped", shipmentDate: orderDate(16), salespersonId: sales1.id, items: [{ sku: "JP-ANIME-01", quantity: 24, saleUnitPrice: 82.5 }, { sku: "GIFT-STICKER-PACK", quantity: 120, saleUnitPrice: 0.9 }], costs: { domestic_shipping: 60, international_shipping: 320, customs_fee: 90, platform_fee: 0, payment_fee: 60 } },
    { orderNo: "ORD-202605-0013", source: "shopify", customer: "Singapore Hobby Hub", channel: channelFor("shopify"), store: "bahomu.com", countryCode: "SG", paidAmount: 1480, orderStatus: "completed", shippingStatus: "delivered", shipmentDate: orderDate(17), salespersonId: sales2.id, items: [{ sku: "BHM-GIFT-01", quantity: 10, saleUnitPrice: 145 }], costs: { platform_fee: 88, payment_fee: 44, international_shipping: 180 } },
    { orderNo: "ORD-202605-0014", source: "amazon", customer: null, channel: channelFor("calembouAmazon"), store: "CALEMBOU-US", countryCode: "US", paidAmount: 960, orderStatus: "completed", shippingStatus: "delivered", shipmentDate: orderDate(18), salespersonId: sales2.id, items: [{ sku: "CLB-AMZ-02", quantity: 8, saleUnitPrice: 120 }], costs: { platform_fee: 185, international_shipping: 90, payment_fee: 20 } },
    { orderNo: "ORD-202605-0015", source: "tiktok_shop", customer: "Urban Anime Store", channel: channelFor("tiktok"), store: "TikTok Shop US", countryCode: "US", paidAmount: 800, orderStatus: "preparing", shippingStatus: "partial_shipped", dueDate: due(7), shipmentDate: orderDate(19), salespersonId: sales1.id, items: [{ sku: "TT-ANIME-01", quantity: 20, saleUnitPrice: 94 }, { sku: "PLUSH-BUNNY-12CM", quantity: 180, saleUnitPrice: 3.2 }], costs: { domestic_shipping: 90, international_shipping: 350, platform_fee: 260, payment_fee: 55 } },
    { orderNo: "ORD-202605-0016", source: "manual", customer: "Green Pet Memories", channel: channelFor("googleSeo"), store: null, countryCode: "US", paidAmount: 0, orderStatus: "pending_payment", shippingStatus: "unshipped", dueDate: due(-4), salespersonId: sales2.id, items: [{ sku: "PET-CLOCK-ACRYLIC", quantity: 40, saleUnitPrice: 13.2 }, { sku: "PET-FRAME-WOOD", quantity: 20, saleUnitPrice: 16.8 }], costs: { domestic_shipping: 70, international_shipping: 260, customs_fee: 60, payment_fee: 0, other: 35 } },
    { orderNo: "ORD-202605-0017", source: "wordpress_wholesale", customer: "Bright Panda Gifts", channel: channelFor("googleAds"), store: "blindboxwholesale.com", countryCode: "CA", paidAmount: 300, orderStatus: "after_sales_reship", shippingStatus: "shipped", dueDate: due(-8), shipmentDate: orderDate(22), salespersonId: sales1.id, items: [{ sku: "PLUSH-PANDA-8CM", quantity: 500, saleUnitPrice: 2.05 }, { sku: "PLUSH-BUNNY-12CM", quantity: 300, saleUnitPrice: 2.65 }], costs: { domestic_shipping: 110, international_shipping: 780, customs_fee: 120, port_charge: 60, trucking_fee: 95, other: 120 } },
    { orderNo: "ORD-202605-0018", source: "manual", customer: "Maison & Co", channel: channelFor("googleSeo"), store: null, countryCode: "FR", paidAmount: 1180, orderStatus: "delivered", shippingStatus: "delivered", shipmentDate: orderDate(23), salespersonId: sales2.id, items: [{ sku: "PET-CLOCK-ACRYLIC", quantity: 60, saleUnitPrice: 19.8 }], costs: { domestic_shipping: 90, international_shipping: 360, customs_fee: 80, payment_fee: 35 } },
    { orderNo: "ORD-202605-0019", source: "amazon", customer: null, channel: channelFor("bahomuJapan"), store: "BAHOMU-JP", countryCode: "JP", paidAmount: 540, orderStatus: "completed", shippingStatus: "delivered", shipmentDate: orderDate(24), salespersonId: sales1.id, items: [{ sku: "BB-KIMMON-OCEAN", quantity: 100, saleUnitPrice: 5.4 }], costs: { platform_fee: 115, international_shipping: 70, payment_fee: 12 } },
    { orderNo: "ORD-202605-0020", source: "manual", customer: "Luna Creator Studio", channel: channelFor("influencer"), store: null, countryCode: "US", paidAmount: 0, orderStatus: "preparing", shippingStatus: "unshipped", dueDate: due(6), salespersonId: sales2.id, items: [{ sku: "BB-KIMMON-OCEAN", quantity: 80, saleUnitPrice: 4.2 }, { sku: "PLUSH-PANDA-8CM", quantity: 120, saleUnitPrice: 2.4 }, { sku: "GIFT-STICKER-PACK", quantity: 200, saleUnitPrice: 0.55 }], costs: { domestic_shipping: 70, international_shipping: 240, platform_fee: 0, payment_fee: 0, other: 60 } },
  ];

  for (const [index, seed] of orderSeeds.entries()) {
    const customer = seed.customer ? customerMap[seed.customer] : null;
    const store = seed.store ? storeByName(seed.store) : null;
    const channel = seed.channel;
    const items = seed.items.map((item) => {
      const product = productMap[item.sku];
      const purchaseUnitCost = item.purchaseUnitCost ?? Number(product?.defaultPurchasePrice ?? 0);
      const packagingUnitCost = item.packagingUnitCost ?? Number(product?.defaultPackagingCost ?? 0);
      const salesSubtotal = money(item.quantity * item.saleUnitPrice);
      const purchaseCostSubtotal = money(item.quantity * purchaseUnitCost);
      const packagingCostSubtotal = money(item.quantity * packagingUnitCost);
      return { ...item, product, purchaseUnitCost, packagingUnitCost, salesSubtotal, purchaseCostSubtotal, packagingCostSubtotal };
    });
    const salesAmount = money(items.reduce((sum, item) => sum + item.salesSubtotal, 0));
    const purchaseAmount = productCost(items);
    const packageAmount = packagingCost(items);
    const manualCosts = { ...costDefaults, ...seed.costs };
    const otherCost = money(Object.values(manualCosts).reduce((sum, value) => sum + value, 0));
    const totalCost = money(purchaseAmount + packageAmount + otherCost);
    const grossProfit = money(salesAmount - totalCost);
    const grossMargin = orderGrossMargin(salesAmount, grossProfit);
    const paidAmount = money(Math.min(seed.paidAmount, salesAmount));
    const unpaidAmount = money(salesAmount - paidAmount);
    const paymentStatus = orderPaymentStatus(salesAmount, paidAmount, seed.orderStatus);
    const actualShipDate = seed.shipmentDate ?? (["shipped", "delivered", "partial_shipped"].includes(seed.shippingStatus) ? orderDate(Math.min((index % 20) + 3, 28)) : null);

    const createdOrder = await prisma.order.create({
      data: {
        orderNo: seed.orderNo,
        externalOrderNo: seed.source === "shopify" ? `SHP-${1000 + index}` : seed.source === "amazon" ? `AMZ-${1000 + index}` : seed.source === "tiktok_shop" ? `TT-${1000 + index}` : null,
        orderSource: seed.source,
        customerId: customer?.id,
        customerName: customer?.name ?? null,
        salespersonId: seed.salespersonId,
        inquiryId: seed.quoteNo ? inquiryMap[seed.quoteNo]?.id : null,
        quoteId: seed.quoteNo ? quoteMap[seed.quoteNo]?.id : null,
        brandId: store?.brandId ?? channel?.brandId ?? customer?.brandId ?? brandMap.BAHOMU.id,
        platformId: store?.platformId ?? channel?.platformId ?? null,
        storeId: store?.id ?? null,
        channelId: channel?.id ?? null,
        countryCode: seed.countryCode,
        currency: "USD",
        exchangeRate: 1,
        baseCurrency: "CNY",
        productAmount: salesAmount,
        shippingFee: 0,
        discountAmount: 0,
        taxAmount: 0,
        otherFee: otherCost,
        totalAmount: salesAmount,
        salesAmount,
        totalCost,
        grossProfit,
        grossMargin,
        paidAmount,
        unpaidAmount,
        orderStatus: seed.orderStatus,
        paymentStatus,
        shippingStatus: seed.shippingStatus,
        orderDate: orderDate((index % 20) + 1),
        shipmentDate: actualShipDate,
        paymentMethod: seed.paidAmount > 0 ? "PayPal / Bank Transfer" : null,
        expectedShipDate: seed.shippingStatus === "unshipped" ? atHour(10 + index, 10) : null,
        actualShipDate,
        dueDate: seed.dueDate ?? null,
        trackingNo: actualShipDate ? `TRK${2026050000 + index}` : null,
        logisticsProvider: actualShipDate ? "DHL" : null,
        createdBy: seed.salespersonId,
        remark: seed.remark ?? "Seed 外贸订单，用于利润核算验收。",
        items: {
          create: items.map((item) => ({
            productId: item.product?.id ?? null,
            sku: item.sku,
            productName: item.product?.name ?? item.sku,
            specification: item.product?.specification ?? null,
            quantity: item.quantity,
            unitPrice: item.saleUnitPrice,
            costPrice: item.purchaseUnitCost,
            totalPrice: item.salesSubtotal,
            totalCost: money(item.purchaseCostSubtotal + item.packagingCostSubtotal),
            saleUnitPrice: item.saleUnitPrice,
            salesSubtotal: item.salesSubtotal,
            purchaseUnitCost: item.purchaseUnitCost,
            purchaseCostSubtotal: item.purchaseCostSubtotal,
            packagingUnitCost: item.packagingUnitCost,
            packagingCostSubtotal: item.packagingCostSubtotal,
            remark: item.remark ?? null,
          })),
        },
        costs: {
          create: [
            { costType: "product_purchase", amount: purchaseAmount, currency: "USD", exchangeRate: 1, baseAmount: purchaseAmount, remark: "由商品明细自动汇总" },
            { costType: "packaging_material", amount: packageAmount, currency: "USD", exchangeRate: 1, baseAmount: packageAmount, remark: "由商品明细自动汇总" },
            ...Object.entries(manualCosts).map(([costType, amount]) => ({ costType, amount: money(amount), currency: "USD", exchangeRate: 1, baseAmount: money(amount), remark: amount ? "Seed 成本分项" : null })),
          ],
        },
      },
    });

    await prisma.orderStatusLog.createMany({
      data: [
        { orderId: createdOrder.id, fromStatus: null, toStatus: "pending_payment", remark: "Seed 创建订单", createdBy: seed.salespersonId },
        ...(seed.orderStatus !== "pending_payment" ? [{ orderId: createdOrder.id, fromStatus: "pending_payment", toStatus: seed.orderStatus, remark: "Seed 状态推进记录", createdBy: seed.salespersonId }] : []),
      ],
    });

    if (index < 6) {
      await prisma.attachment.create({
        data: {
          bizType: "order",
          bizId: createdOrder.id,
          fileName: `${seed.orderNo}_装箱单示例.txt`,
          fileUrl: `/uploads/orders/${createdOrder.id}/seed-packing-list.txt`,
          fileType: "text/plain",
          fileSize: 128,
          attachmentType: index % 2 === 0 ? "packing_list" : "payment_proof",
          uploadedBy: seed.salespersonId,
        },
      });
    }
  }

  console.log(`Seed completed. Admin user: ${admin.email}. CRM customers: ${customerSeeds.length + extraCustomerSeeds.length}. Orders: ${orderSeeds.length}`);
}

