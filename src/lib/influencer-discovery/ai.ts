import "server-only";

import { callClaudeJson, getAiStatus } from "@/lib/ai/anthropic-client";
import type { AiScoreHint, CandidateScoringInput, KeywordPool, WebsiteAnalysis, WebsiteContent } from "./types";

// ——— System prompts ———

const websiteSystemPrompt = `你是跨境电商红人营销分析师。根据品牌官网文本,分析这个品牌适合找什么类型的红人。
只能输出严格 JSON,不要输出 Markdown,不要在 JSON 之外输出任何文字。
不要编造网站里没有的信息;信息不足的字段给空字符串或空数组。
keywords 是可用于在 YouTube/TikTok/Instagram 等平台搜索红人的英文关键词。
creatorNiches 是适合的红人垂类(如 toy review、unboxing、kids crafts)。
negativeKeywords 是应排除的不相关方向。
keywordPool 是分层关键词池,用于自动在 YouTube 搜索创作者:
- highIntentKeywords: 高购买/开箱意图的英文长尾词,应结合 IP + merch/unboxing/haul/figure/plush(如 "Genshin figure unboxing"、"anime merch haul");
- ipKeywords: IP 精准词(如 "Genshin Impact merch");
- contentFormatKeywords: 内容形式词(如 unboxing、review、haul、blind box opening);
- creatorNicheKeywords: 红人类型词(如 figure collector、toy reviewer);
- negativeKeywords: 排除词(如 official trailer、AMV、reaction、gameplay only)。
关键词用英文,避免过泛的单词(anime、game、cute、gift)。`;

const scoringSystemPrompt = `你是红人营销评分助手。根据品牌画像与红人数据,对每个评分维度给出 0 到该维度满分之间的分数,并简述理由。
只能输出严格 JSON,不要输出 Markdown。不要编造红人没有的数据;数据缺失时给保守分。
各维度满分:contentFit=25, ipProductFit=15, dataQuality=15, engagementQuality=10, audienceFit=10, commercePotential=10, costEfficiency=10, contactability=5, riskPenalty(扣分绝对值,0-10)。`;

const websiteSchemaHint = `{
  "brandName": "品牌名(取不到给空串)",
  "brandSummary": "1-2 句品牌总结",
  "productSummary": "1-2 句主营产品总结",
  "audienceSummary": "1-2 句目标受众总结",
  "creatorPersona": "1-2 句适合的红人画像",
  "primaryCategories": ["主营品类"],
  "priceBands": ["价格带,如 $10-30"],
  "targetRegions": ["US","UK"],
  "creatorNiches": ["toy review","unboxing"],
  "platforms": ["Instagram","TikTok","YouTube"],
  "keywords": ["搜索关键词"],
  "negativeKeywords": ["排除关键词"],
  "recommendedOfferTypes": ["gifted","affiliate","paid"],
  "notes": ["补充说明"],
  "keywordPool": {
    "highIntentKeywords": ["Genshin figure unboxing","anime merch haul"],
    "ipKeywords": ["Genshin Impact merch"],
    "contentFormatKeywords": ["unboxing","review","haul"],
    "creatorNicheKeywords": ["figure collector","toy reviewer"],
    "negativeKeywords": ["official trailer","AMV","reaction"]
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
    contentFormatKeywords: strArray(input.contentFormatKeywords, 20),
    creatorNicheKeywords: strArray(input.creatorNicheKeywords, 20),
    negativeKeywords: strArray(input.negativeKeywords, 20),
  };
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

  // 规则化 keywordPool:用高频词 + 常见内容形式词拼装,保证 AI 关时自动搜索仍有词可用
  const topWords = keywords.slice(0, 5);
  const fallbackPool: KeywordPool = {
    highIntentKeywords: topWords.map((w) => `${w} unboxing`),
    ipKeywords: topWords,
    contentFormatKeywords: ["unboxing", "review", "haul"],
    creatorNicheKeywords: [],
    negativeKeywords: ["official trailer", "music video", "reaction", "gameplay"],
  };

  return {
    brandName: title,
    brandSummary: content.metaDescription || `根据 ${content.domain} 首页信息生成的基础画像(AI 未启用)。`,
    productSummary: content.productTexts[0] || content.collectionTexts[0] || "未能识别具体产品信息,建议补充。",
    audienceSummary: "AI 未启用,受众画像需人工补充。",
    creatorPersona: "建议优先寻找与主营品类相关的垂类中腰部红人。",
    primaryCategories: [],
    priceBands: [],
    targetRegions: [],
    creatorNiches: [],
    platforms: ["Instagram", "TikTok", "YouTube"],
    keywords,
    negativeKeywords: [],
    recommendedOfferTypes: ["gifted", "affiliate"],
    notes: ["本画像由规则生成(AI_ANALYSIS_ENABLED 未开启或调用失败),仅供参考。"],
    keywordPool: fallbackPool,
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
