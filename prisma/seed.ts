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

  await prisma.order.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.inquiry.deleteMany();

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

  const orderSeeds = [
    { orderNo: "ORD-202605-0001", source: "quote", customer: "Pacific Toy Wholesale LLC", channel: channelFor("googleSeo"), store: "blindboxwholesale.com", quoteNo: "QUO-202605-0001", countryCode: "US", productAmount: 3200, shippingFee: 480, discountAmount: 100, paidAmount: 1000, orderStatus: "confirmed", shippingStatus: "unshipped", dueDate: due(-3), items: [["BB-MIX-24", "Blind Box Mixed Case", 40, 80, 45]] },
    { orderNo: "ORD-202605-0002", source: "shopify", customer: "MiniJoy Retail Ltd", channel: channelFor("shopify"), store: "bahomu.com", countryCode: "UK", productAmount: 2160, shippingFee: 0, discountAmount: 0, paidAmount: 2160, orderStatus: "processing", shippingStatus: "unshipped", items: [["BHM-GIFT-01", "Gift Mystery Box", 24, 90, 42]] },
    { orderNo: "ORD-202605-0003", source: "amazon", customer: null, channel: channelFor("bahomuJapan"), store: "BAHOMU-JP", countryCode: "JP", productAmount: 880, shippingFee: 0, discountAmount: 0, paidAmount: 880, orderStatus: "completed", shippingStatus: "delivered", items: [["JP-AMZ-01", "Amazon JP Box", 8, 110, 58]] },
    { orderNo: "ORD-202605-0004", source: "amazon", customer: null, channel: channelFor("calembouAmazon"), store: "CALEMBOU-US", countryCode: "US", productAmount: 1260, shippingFee: 0, discountAmount: 0, paidAmount: 1260, orderStatus: "shipped", shippingStatus: "shipped", items: [["CLB-US-01", "CALEMBOU Amazon Bundle", 12, 105, 50]] },
    { orderNo: "ORD-202605-0005", source: "tiktok_shop", customer: "Urban Anime Store", channel: channelFor("tiktok"), store: "TikTok Shop US", countryCode: "US", productAmount: 3420, shippingFee: 0, discountAmount: 0, paidAmount: 0, orderStatus: "confirmed", shippingStatus: "unshipped", dueDate: due(0), items: [["TT-ANIME-01", "TikTok Anime Blind Box", 36, 95, 46]] },
    { orderNo: "ORD-202605-0006", source: "manual", customer: "Oceanic Trading Pty", channel: channelFor("edm"), store: null, countryCode: "AU", productAmount: 6120, shippingFee: 0, discountAmount: 0, paidAmount: 6120, orderStatus: "completed", shippingStatus: "delivered", items: [["BHM-OLD-01", "Repeat Customer Bundle", 72, 85, 39]] },
    { orderNo: "ORD-202605-0007", source: "wordpress_wholesale", customer: "Blue Whale Imports", channel: channelFor("googleSeo"), store: "blindboxwholesale.com", countryCode: "NL", productAmount: 4980, shippingFee: 0, discountAmount: 0, paidAmount: 1500, orderStatus: "processing", shippingStatus: "partial_shipped", dueDate: due(5), items: [["BB-WHOLE-12", "Wholesale Blind Box Pack", 60, 83, 40]] },
    { orderNo: "ORD-202605-0008", source: "shopify", customer: "HappyKids Store", channel: channelFor("shopify"), store: "bahomu.com", countryCode: "US", productAmount: 780, shippingFee: 0, discountAmount: 0, paidAmount: 780, orderStatus: "completed", shippingStatus: "delivered", items: [["BHM-KIDS-01", "Kids Gift Box", 6, 130, 56]] },
    { orderNo: "ORD-202605-0009", source: "quote", customer: "Seoul Pop Mart Reseller", channel: channelFor("googleSeo"), store: "blindboxwholesale.com", quoteNo: "QUO-202605-0002", countryCode: "KR", productAmount: 5400, shippingFee: 0, discountAmount: 0, paidAmount: 0, orderStatus: "confirmed", shippingStatus: "unshipped", dueDate: due(-7), items: [["BB-KR-SET", "Korea Reseller Blind Box Set", 60, 90, 44]] },
    { orderNo: "ORD-202605-0010", source: "quote", customer: "Dubai Gift Trading", channel: channelFor("googleSeo"), store: "blindboxwholesale.com", quoteNo: "QUO-202605-0003", countryCode: "AE", productAmount: 4200, shippingFee: 0, discountAmount: 0, paidAmount: 2000, orderStatus: "processing", shippingStatus: "unshipped", dueDate: due(2), items: [["BB-ME-42", "Middle East Gift Blind Box", 42, 100, 48]] },
    { orderNo: "ORD-202605-0011", source: "quote", customer: "Blue Whale Imports", channel: channelFor("googleSeo"), store: "blindboxwholesale.com", quoteNo: "QUO-202605-0004", countryCode: "NL", productAmount: 2380, shippingFee: 260, discountAmount: 0, paidAmount: 0, orderStatus: "pending_confirm", shippingStatus: "unshipped", dueDate: due(-1), items: [["BB-NL-01", "Netherlands Refill Pack", 28, 85, 39]] },
    { orderNo: "ORD-202605-0012", source: "quote", customer: "Sakura Collectibles Co.", channel: channelFor("bahomuJapan"), store: "BAHOMU-JP", quoteNo: "QUO-202605-0005", countryCode: "JP", productAmount: 1980, shippingFee: 320, discountAmount: 100, paidAmount: 2200, orderStatus: "shipped", shippingStatus: "shipped", items: [["JP-ANIME-01", "Anime Collectible Box", 24, 82.5, 36]] },
    { orderNo: "ORD-202605-0013", source: "shopify", customer: "Singapore Hobby Hub", channel: channelFor("shopify"), store: "bahomu.com", countryCode: "SG", productAmount: 1450, shippingFee: 60, discountAmount: 30, paidAmount: 1480, orderStatus: "completed", shippingStatus: "delivered", items: [["BHM-SG-01", "Singapore Hobby Bundle", 10, 145, 68]] },
    { orderNo: "ORD-202605-0014", source: "amazon", customer: null, channel: channelFor("calembouAmazon"), store: "CALEMBOU-US", countryCode: "US", productAmount: 960, shippingFee: 0, discountAmount: 0, paidAmount: 960, orderStatus: "completed", shippingStatus: "delivered", items: [["CLB-AMZ-02", "Amazon CALEMBOU Set", 8, 120, 54]] },
    { orderNo: "ORD-202605-0015", source: "tiktok_shop", customer: "Urban Anime Store", channel: channelFor("tiktok"), store: "TikTok Shop US", countryCode: "US", productAmount: 1880, shippingFee: 120, discountAmount: 0, paidAmount: 800, orderStatus: "processing", shippingStatus: "partial_shipped", dueDate: due(7), items: [["TT-ANIME-02", "TikTok Reorder Box", 20, 94, 45]] },
  ];

  for (const [index, seed] of orderSeeds.entries()) {
    const customer = seed.customer ? customerMap[seed.customer] : null;
    const store = seed.store ? storeByName(seed.store) : null;
    const channel = seed.channel;
    const totalAmount = money(seed.productAmount + seed.shippingFee - seed.discountAmount);
    const unpaidAmount = money(totalAmount - seed.paidAmount);
    const paymentStatus = orderPaymentStatus(totalAmount, seed.paidAmount, seed.orderStatus);
    await prisma.order.create({
      data: {
        orderNo: seed.orderNo,
        externalOrderNo: seed.source === "shopify" ? `SHP-${1000 + index}` : seed.source === "amazon" ? `AMZ-${1000 + index}` : seed.source === "tiktok_shop" ? `TT-${1000 + index}` : null,
        orderSource: seed.source,
        customerId: customer?.id,
        inquiryId: seed.quoteNo ? inquiryMap[seed.quoteNo]?.id : null,
        quoteId: seed.quoteNo ? quoteMap[seed.quoteNo]?.id : null,
        brandId: store?.brandId ?? channel?.brandId ?? customer?.brandId ?? brandMap.BAHOMU.id,
        platformId: store?.platformId ?? channel?.platformId ?? null,
        storeId: store?.id ?? null,
        channelId: channel?.id ?? null,
        countryCode: seed.countryCode,
        currency: "USD",
        productAmount: seed.productAmount,
        shippingFee: seed.shippingFee,
        discountAmount: seed.discountAmount,
        taxAmount: 0,
        otherFee: 0,
        totalAmount,
        paidAmount: seed.paidAmount,
        unpaidAmount,
        orderStatus: seed.orderStatus,
        paymentStatus,
        shippingStatus: seed.shippingStatus,
        orderDate: orderDate((index % 20) + 1),
        expectedShipDate: seed.shippingStatus === "unshipped" ? atHour(10 + index, 10) : null,
        actualShipDate: ["shipped", "delivered", "partial_shipped"].includes(seed.shippingStatus) ? orderDate(Math.min((index % 20) + 3, 28)) : null,
        dueDate: seed.dueDate ?? null,
        trackingNo: ["shipped", "delivered", "partial_shipped"].includes(seed.shippingStatus) ? `TRK${2026050000 + index}` : null,
        logisticsProvider: ["shipped", "delivered", "partial_shipped"].includes(seed.shippingStatus) ? "DHL" : null,
        createdBy: admin.id,
        remark: "Seed 订单，用于订单中心第一版验证。",
        items: {
          create: seed.items.map(([sku, productName, quantity, unitPrice, costPrice]) => ({
            sku: String(sku),
            productName: String(productName),
            quantity: Number(quantity),
            unitPrice: Number(unitPrice),
            costPrice: Number(costPrice),
            totalPrice: money(Number(quantity) * Number(unitPrice)),
            totalCost: money(Number(quantity) * Number(costPrice)),
          })),
        },
      },
    });
  }

  console.log(`Seed completed. Admin user: ${admin.email}. CRM customers: ${customerSeeds.length + extraCustomerSeeds.length}. Orders: ${orderSeeds.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
