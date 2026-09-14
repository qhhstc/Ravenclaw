import "server-only";

import { callClaudeJson, getAiStatus } from "@/lib/ai/anthropic-client";
import type { AiScoreHint, CandidateScoringInput, IdealCreatorProfile, KeywordPool, TargetCustomerProfile, WebsiteAnalysis, WebsiteContent } from "./types";

// ——— System prompts ———

const websiteSystemPrompt = `你是跨境电商红人营销分析师。根据品牌官网文本与产品数据,深入分析这个品牌适合找什么类型的红人。
只能输出严格 JSON,不要输出 Markdown,不要在 JSON 之外输出任何文字。
不要编造网站里没有的信息;信息不足的字段给空字符串或空数组。

要求分析得具体、不泛泛:
- mainIps: 识别具体 IP/系列,如 Genshin Impact、Honkai Star Rail、Zenless Zone Zero、Wuthering Waves;不要只写 "anime"/"game"。
- mainProductTypes: 具体品类,如 anime figure、plush、blind box、acrylic stand、official merchandise。
- heroProducts/entryProducts: 引流款与高客单款示例。
- preorderSignals/trustSignals/conversionBarriers: 预售信号(pre-order)、信任卖点(official/authentic)、转化阻碍(高价/长预售期/运费)。
- targetCustomerProfile: regions/interests/buyingMotivations/concerns。
- idealCreatorProfiles: 每个含 type(具体如 "anime figure unboxing creator"、"HoYoverse collector"、"plush reviewer"、"cosplayer",不要只写 "anime influencer")、reason、platforms、contentFormats、recommendedOffer(paid/gifted/affiliate/nurture)。
- unsuitableCreatorProfiles: 不适合的红人类型。
- creatorPersona: 一句具体画像。
- keywordPool.highIntentKeywords: 必须优先带购买/开箱意图,结合 IP + merch/unboxing/haul/figure/plush(如 "Genshin figure unboxing"、"Honkai Star Rail merch haul"、"anime plush collection"、"blind box opening anime")。
- keywordPool.negativeKeywords: 必须包含 official trailer、music video、AMV、reaction、gameplay only、news、leak、download。
- autoSearchKeywords: 从 highIntentKeywords 精选 3-5 个最适合在 YouTube 搜创作者的关键词。
关键词用英文,避免过泛的单词(anime、game、cute、gift、best、official)。`;

const scoringSystemPrompt = `你是红人营销评分助手。根据品牌画像与红人数据,对每个评分维度给出 0 到该维度满分之间的分数,并简述理由。
只能输出严格 JSON,不要输出 Markdown。不要编造红人没有的数据;数据缺失时给保守分。
各维度满分:contentFit=25, ipProductFit=15, dataQuality=15, engagementQuality=10, audienceFit=10, commercePotential=10, costEfficiency=10, contactability=5, riskPenalty(扣分绝对值,0-10)。`;

const websiteSchemaHint = `{
  "brandName": "品牌名(取不到给空串)",
  "brandSummary": "1-2 句品牌总结",
  "productSummary": "1-2 句主营产品总结",
  "audienceSummary": "1-2 句目标受众总结",
  "creatorPersona": "1 句具体红人画像,如 anime figure unboxing creator",
  "primaryCategories": ["主营品类"],
  "priceBands": ["价格带,如 $10-30"],
  "targetRegions": ["US","UK"],
  "creatorNiches": ["figure review","unboxing"],
  "platforms": ["YouTube","Instagram","TikTok"],
  "keywords": ["搜索关键词"],
  "negativeKeywords": ["排除关键词"],
  "recommendedOfferTypes": ["gifted","affiliate","paid"],
  "notes": ["补充说明"],
  "mainIps": ["Genshin Impact","Honkai Star Rail"],
  "mainProductTypes": ["anime figure","plush","blind box"],
  "heroProducts": ["示例爆款"],
  "entryProducts": ["示例引流款"],
  "preorderSignals": ["pre-order","预售"],
  "trustSignals": ["official","authentic"],
  "conversionBarriers": ["高客单","长预售期"],
  "targetCustomerProfile": { "regions": ["US"], "interests": ["anime","gaming"], "buyingMotivations": ["collect","fandom"], "concerns": ["price","authenticity"] },
  "idealCreatorProfiles": [ { "type": "anime figure unboxing creator", "reason": "契合开箱转化", "platforms": ["YouTube"], "contentFormats": ["unboxing","haul"], "recommendedOffer": "gifted" } ],
  "unsuitableCreatorProfiles": ["纯 gameplay 主播","AMV 剪辑号"],
  "autoSearchKeywords": ["Genshin figure unboxing","anime merch haul"],
  "keywordPool": {
    "highIntentKeywords": ["Genshin figure unboxing","anime merch haul","blind box opening anime"],
    "ipKeywords": ["Genshin Impact merch","Honkai Star Rail merch"],
    "productKeywords": ["anime figure","plush","blind box"],
    "contentFormatKeywords": ["unboxing","review","haul"],
    "creatorNicheKeywords": ["figure collector","plush reviewer"],
    "negativeKeywords": ["official trailer","music video","AMV","reaction","gameplay only","news","leak","download"]
  }
}`;

const scoringSchemaHint = `{
  "contentFit": 0, "ipProductFit": 0, "dataQuality": 0, "engagementQuality": 0,
  "audienceFit": 0, "commercePotential": 0, "costEfficiency": 0, "contactability": 0,
  "riskPenalty": 0, "reason": "评分理由", "risks": ["风险点"]
}`;

// ——— normalize(AI 不可信,全部兜底) ———

function strArray(value: unknown, limit = 20): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim()).slice(0, limit);
}

function str(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeKeywordPool(value: unknown): KeywordPool {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    highIntentKeywords: strArray(input.highIntentKeywords, 20),
    ipKeywords: strArray(input.ipKeywords, 20),
    productKeywords: strArray(input.productKeywords, 20),
    contentFormatKeywords: strArray(input.contentFormatKeywords, 20),
    creatorNicheKeywords: strArray(input.creatorNicheKeywords, 20),
    negativeKeywords: strArray(input.negativeKeywords, 20),
  };
}

function normalizeTargetCustomer(value: unknown): TargetCustomerProfile {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    regions: strArray(input.regions, 15),
    interests: strArray(input.interests, 15),
    buyingMotivations: strArray(input.buyingMotivations, 15),
    concerns: strArray(input.concerns, 15),
  };
}

function normalizeIdealCreators(value: unknown): IdealCreatorProfile[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object")
    .map((v) => ({
      type: str(v.type),
      reason: str(v.reason),
      platforms: strArray(v.platforms, 6),
      contentFormats: strArray(v.contentFormats, 8),
      recommendedOffer: str(v.recommendedOffer),
    }))
    .filter((c) => c.type)
    .slice(0, 8);
}

function normalizeWebsiteAnalysis(value: unknown, aiGenerated: boolean): WebsiteAnalysis {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    brandName: str(input.brandName),
    brandSummary: str(input.brandSummary),
    productSummary: str(input.productSummary),
    audienceSummary: str(input.audienceSummary),
    creatorPersona: str(input.creatorPersona),
    primaryCategories: strArray(input.primaryCategories),
    priceBands: strArray(input.priceBands),
    targetRegions: strArray(input.targetRegions),
    creatorNiches: strArray(input.creatorNiches),
    platforms: strArray(input.platforms),
    keywords: strArray(input.keywords, 40),
    negativeKeywords: strArray(input.negativeKeywords),
    recommendedOfferTypes: strArray(input.recommendedOfferTypes),
    notes: strArray(input.notes),
    keywordPool: normalizeKeywordPool(input.keywordPool),
    mainIps: strArray(input.mainIps, 15),
    mainProductTypes: strArray(input.mainProductTypes, 15),
    heroProducts: strArray(input.heroProducts, 15),
    entryProducts: strArray(input.entryProducts, 15),
    preorderSignals: strArray(input.preorderSignals, 10),
    trustSignals: strArray(input.trustSignals, 10),
    conversionBarriers: strArray(input.conversionBarriers, 10),
    targetCustomerProfile: normalizeTargetCustomer(input.targetCustomerProfile),
    idealCreatorProfiles: normalizeIdealCreators(input.idealCreatorProfiles),
    unsuitableCreatorProfiles: strArray(input.unsuitableCreatorProfiles, 15),
    autoSearchKeywords: strArray(input.autoSearchKeywords, 5),
    aiGenerated,
  };
}

// ——— fallback:AI 未开启/失败时的规则化画像,保证整页不报错 ———

export function fallbackWebsiteAnalysis(content: WebsiteContent): WebsiteAnalysis {
  const title = content.pageTitle || content.domain;
  // 从标题/描述/标题词中粗取关键词
  const rawText = [content.pageTitle, content.metaDescription, ...content.headings].join(" ");
  const words = rawText
    .toLowerCase()
    .replace(/[^a-z0-9一-龥\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  const freq = new Map<string, number>();
  const stop = new Set(["the", "and", "for", "with", "your", "our", "you", "shop", "home", "all", "new", "from", "this"]);
  words.forEach((w) => {
    if (stop.has(w)) return;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  });
  const keywords = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w]) => w);

  // 优先用电商接口拿到的结构化品类/标签,其次高频词
  const productTypes = (content.productTypes ?? []).slice(0, 8);
  const productTags = (content.productTags ?? []).slice(0, 12);
  const sitemapKw = (content.sitemapKeywords ?? []).slice(0, 10);
  const typeSeeds = [...new Set([...productTypes, ...productTags, ...sitemapKw, ...keywords])].filter(Boolean).slice(0, 8);
  const NEG = ["official trailer", "music video", "AMV", "reaction", "gameplay only", "news", "leak", "download"];
  const FORMATS = ["unboxing", "review", "haul", "collection"];

  // 规则化 keywordPool + autoSearchKeywords:用品类词 × 内容形式拼高意图长尾,保证 AI 关时自动搜索仍有词可用
  const highIntent = typeSeeds.slice(0, 5).map((w) => `${w} unboxing`);
  const autoSearchKeywords = highIntent.slice(0, 5);
  const fallbackPool: KeywordPool = {
    highIntentKeywords: highIntent,
    ipKeywords: typeSeeds,
    productKeywords: [...productTypes, ...productTags].slice(0, 12),
    contentFormatKeywords: FORMATS,
    creatorNicheKeywords: [],
    negativeKeywords: NEG,
  };

  return {
    brandName: title,
    brandSummary: content.metaDescription || `根据 ${content.domain} 首页与产品信息生成的基础画像(AI 未启用)。`,
    productSummary: productTypes.length ? `主营品类:${productTypes.join("、")}。` : content.productTexts[0] || content.collectionTexts[0] || "未能识别具体产品信息,建议补充。",
    audienceSummary: "AI 未启用,受众画像需人工补充。",
    creatorPersona: productTypes[0] ? `${productTypes[0]} unboxing / review creator` : "与主营品类相关的垂类中腰部红人。",
    primaryCategories: productTypes,
    priceBands: (content.priceSamples ?? []).slice(0, 3),
    targetRegions: [],
    creatorNiches: [],
    platforms: ["YouTube", "Instagram", "TikTok"],
    keywords,
    negativeKeywords: NEG,
    recommendedOfferTypes: ["gifted", "affiliate"],
    notes: ["本画像由规则生成(AI_ANALYSIS_ENABLED 未开启或调用失败),仅供参考。"],
    keywordPool: fallbackPool,
    mainIps: (content.productVendors ?? []).slice(0, 8),
    mainProductTypes: productTypes,
    heroProducts: (content.productTitles ?? []).slice(0, 5),
    entryProducts: [],
    preorderSignals: [],
    trustSignals: [],
    conversionBarriers: [],
    targetCustomerProfile: { regions: [], interests: [], buyingMotivations: [], concerns: [] },
    idealCreatorProfiles: [],
    unsuitableCreatorProfiles: [],
    autoSearchKeywords,
    aiGenerated: false,
  };
}

/**
 * 网站画像分析:AI 开启则调用 Claude,否则/失败则走 fallback,始终返回结果不抛错。
 */
export async function analyzeWebsite(content: WebsiteContent): Promise<WebsiteAnalysis> {
  if (!getAiStatus().enabled) return fallbackWebsiteAnalysis(content);
  try {
    const userPrompt = `请分析以下品牌官网信息,并只返回符合结构的 JSON。

网站信息:
${JSON.stringify(
      {
        websiteUrl: content.finalUrl,
        domain: content.domain,
        pageTitle: content.pageTitle,
        metaDescription: content.metaDescription,
        headings: content.headings.slice(0, 20),
        navigationTexts: content.navigationTexts,
        productTexts: content.productTexts,
        collectionTexts: content.collectionTexts,
        productTitles: (content.productTitles ?? []).slice(0, 50),
        productVendors: content.productVendors ?? [],
        productTypes: content.productTypes ?? [],
        productTags: (content.productTags ?? []).slice(0, 40),
        priceSamples: content.priceSamples ?? [],
        collectionKeywords: content.collectionKeywords ?? [],
        sitemapKeywords: content.sitemapKeywords ?? [],
        bodyExcerpt: content.bodyText.slice(0, 3000),
      },
      null,
      0,
    )}`;
    const result = await callClaudeJson<unknown>({
      systemPrompt: websiteSystemPrompt,
      userPrompt,
      schemaHint: websiteSchemaHint,
      maxTokens: 2000,
    });
    return normalizeWebsiteAnalysis(result, true);
  } catch (error) {
    console.error("[influencer-discovery] analyzeWebsite failed, falling back", error instanceof Error ? error.message : error);
    return fallbackWebsiteAnalysis(content);
  }
}

/**
 * AI 评分辅助(hint)。返回 null 表示 AI 未启用/失败,由 scoring.ts 纯规则评分。
 * 注意:返回值不可信,scoring.ts 会 clamp 并重算 total。
 */
export async function scoreCandidateWithAi(candidate: CandidateScoringInput, brand?: WebsiteAnalysis): Promise<AiScoreHint | null> {
  if (!getAiStatus().enabled) return null;
  try {
    const userPrompt = `品牌画像:
${JSON.stringify(
      brand
        ? {
            brandSummary: brand.brandSummary,
            productSummary: brand.productSummary,
            audienceSummary: brand.audienceSummary,
            creatorNiches: brand.creatorNiches,
            targetRegions: brand.targetRegions,
            keywords: brand.keywords,
          }
        : { note: "无品牌画像(候选未绑定分析任务)" },
      null,
      0,
    )}

红人数据:
${JSON.stringify(
      {
        platform: candidate.platform,
        country: candidate.country,
        followers: candidate.followers,
        avgViews: candidate.avgViews,
        engagementRate: candidate.engagementRate,
        avgLikes: candidate.avgLikes,
        avgComments: candidate.avgComments,
        nicheTags: candidate.nicheTags,
        hasEmail: Boolean(candidate.email),
        hasProfileUrl: Boolean(candidate.profileUrl),
        hasCost: Boolean(candidate.hasCost),
      },
      null,
      0,
    )}`;
    const result = (await callClaudeJson<Record<string, unknown>>({
      systemPrompt: scoringSystemPrompt,
      userPrompt,
      schemaHint: scoringSchemaHint,
      maxTokens: 1000,
    })) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
    return {
      contentFit: num(result.contentFit),
      ipProductFit: num(result.ipProductFit),
      dataQuality: num(result.dataQuality),
      engagementQuality: num(result.engagementQuality),
      audienceFit: num(result.audienceFit),
      commercePotential: num(result.commercePotential),
      costEfficiency: num(result.costEfficiency),
      contactability: num(result.contactability),
      riskPenalty: num(result.riskPenalty),
      reason: typeof result.reason === "string" ? result.reason : undefined,
      risks: Array.isArray(result.risks) ? result.risks.filter((r): r is string => typeof r === "string") : undefined,
    };
  } catch (error) {
    console.error("[influencer-discovery] scoreCandidateWithAi failed, using rules only", error instanceof Error ? error.message : error);
    return null;
  }
}
