import "server-only";

import { prisma } from "@/lib/prisma";
import { scoreCandidateById } from "@/lib/influencer-discovery/score-runner";
import { AUTO_IMPORT_RELEVANCE_THRESHOLD, type KeywordPool, type WebsiteAnalysis } from "@/lib/influencer-discovery/types";
import { ExternalSourceError, type ExternalCandidatePreview } from "./types";
import { getYoutubeStatus, searchYoutubeCreators } from "./youtube";
import { buildCandidateCreateInput, RunDedup } from "./candidate-import";

export type AutoDiscoverySummary = {
  enabled: boolean;
  searchedKeywords: string[];
  found: number;
  qualified: number;
  filtered: number;
  created: number;
  skipped: number;
  scored: number;
  error?: string;
  ranAt?: string;
};

export type RelevanceResult = {
  relevanceScore: number;
  reasons: string[];
  penalties: string[];
  shouldImport: boolean;
};

// 加权/降权词表
const BOOST_TERMS = ["merch", "unboxing", "haul", "review", "figure", "plush", "blind box", "cosplay", "genshin", "honkai", "zenless", "wuthering waves"];
const GENERIC_TERMS = ["anime", "game", "cute", "gift", "official", "best"];
const INTENT_TERMS = ["unboxing", "haul", "review", "merch", "collection", "blind box"];

function isGeneric(kw: string) {
  const lower = kw.toLowerCase().trim();
  return GENERIC_TERMS.includes(lower);
}

function keywordScore(kw: string): number {
  const lower = kw.toLowerCase();
  let score = 0;
  // 产品匹配 30 + IP 精准 20:命中加权词
  const boostHits = BOOST_TERMS.filter((t) => lower.includes(t)).length;
  score += Math.min(boostHits, 3) * 16.6; // 最多约 50(产品+IP)
  // 购买/开箱意图 30
  if (INTENT_TERMS.some((t) => lower.includes(t))) score += 30;
  // 平台搜索友好 10:多词长尾更友好
  const wordCount = lower.trim().split(/\s+/).length;
  if (wordCount >= 2 && wordCount <= 5) score += 10;
  // 新鲜度 10:非泛词
  if (!isGeneric(kw)) score += 10;
  // 泛词降权
  if (isGeneric(kw)) score -= 20;
  return score;
}

const RELEVANCE_CONTENT_TERMS = ["merch", "unboxing", "haul", "review", "figure", "plush", "blind box"];
const RELEVANCE_CREATOR_TERMS = ["collector", "review", "unboxing", "haul"];

// 候选相关性预评分(V1.2):0-100,决定自动发现是否导入。手动搜索不受此限制。
export function evaluateYoutubeCandidateRelevance(candidate: ExternalCandidatePreview, analysis: WebsiteAnalysis): RelevanceResult {
  const title = (candidate.displayName ?? "").toLowerCase();
  const handle = (candidate.handle ?? "").toLowerCase();
  const sampleTitles = (candidate.contentSamples ?? []).map((s) => (s.title ?? "").toLowerCase()).join(" ");
  const haystack = `${title} ${handle} ${sampleTitles}`;
  const reasons: string[] = [];
  const penalties: string[] = [];
  let score = 0;

  // 加分
  if (RELEVANCE_CONTENT_TERMS.some((t) => sampleTitles.includes(t))) { score += 20; reasons.push("样本视频含 merch/unboxing/haul 等意图词"); }
  const ipHit = (analysis.mainIps ?? []).some((ip) => ip && haystack.includes(ip.toLowerCase()));
  if (ipHit) { score += 20; reasons.push("命中品牌主要 IP"); }
  const typeHit = (analysis.mainProductTypes ?? []).some((t) => t && haystack.includes(t.toLowerCase()));
  if (typeHit) { score += 15; reasons.push("命中主打品类"); }
  if (RELEVANCE_CREATOR_TERMS.some((t) => haystack.includes(t))) { score += 15; reasons.push("频道/视频含 collector/review 等红人特征"); }
  if ((candidate.avgViews ?? 0) > 1000) { score += 10; reasons.push("平均播放 > 1000"); }
  if (candidate.followers != null) { score += 5; reasons.push("有粉丝数据"); }

  // 扣分
  if (/\bofficial\b/.test(haystack)) { score -= 30; penalties.push("疑似官方频道"); }
  if (/trailer|music video|\bmv\b/.test(haystack)) { score -= 30; penalties.push("含 trailer/MV"); }
  if (/gameplay/.test(haystack)) { score -= 20; penalties.push("纯 gameplay"); }
  if (/reaction/.test(haystack)) { score -= 15; penalties.push("reaction 内容"); }
  if (/\bamv\b/.test(haystack)) { score -= 20; penalties.push("AMV 剪辑"); }
  if (/news|leak/.test(haystack)) { score -= 20; penalties.push("news/leak 内容"); }
  if (!RELEVANCE_CONTENT_TERMS.some((t) => haystack.includes(t))) { score -= 25; penalties.push("完全无 merch/unboxing/figure 等相关词"); }

  const relevanceScore = Math.max(0, Math.min(100, score));
  return { relevanceScore, reasons, penalties, shouldImport: relevanceScore >= AUTO_IMPORT_RELEVANCE_THRESHOLD };
}

// keywordPool 缺失时从 analysis 其他字段兜底拼词池
function fallbackKeywords(analysis: WebsiteAnalysis, runKeywords: string[]): string[] {
  const pool = [
    ...(analysis.keywords ?? []),
    ...(analysis.creatorNiches ?? []),
    ...(analysis.primaryCategories ?? []),
    ...runKeywords,
  ];
  // productSummary 里抽名词性短语较难,简单加入其分词后的高信息词
  const summaryWords = (analysis.productSummary ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !isGeneric(w));
  return [...pool, ...summaryWords];
}

/**
 * 从画像选自动搜索关键词:优先 highIntent,其次含加权词的 ip,再补 keywords。
 * 过滤太短/纯泛词、去重,最多 maxKeywords 个。
 */
export function selectAutoSearchKeywords(analysis: WebsiteAnalysis, maxKeywords = 5, runKeywords: string[] = []): string[] {
  const pool: KeywordPool | undefined = analysis.keywordPool;
  const candidates: string[] = [];

  // 1) AI 精选的 autoSearchKeywords 最优先
  if (analysis.autoSearchKeywords?.length) candidates.push(...analysis.autoSearchKeywords);

  if (pool && (pool.highIntentKeywords.length || pool.ipKeywords.length || (pool.productKeywords?.length ?? 0))) {
    // 2) highIntent
    candidates.push(...pool.highIntentKeywords);
    // 3) IP × product 组合生成高意图长尾
    const ips = pool.ipKeywords.slice(0, 4);
    const combos = ["figure unboxing", "merch haul", "plush review"];
    for (const ip of ips) {
      for (const c of combos) candidates.push(`${ip} ${c}`);
    }
    candidates.push(...pool.ipKeywords.filter((k) => BOOST_TERMS.some((t) => k.toLowerCase().includes(t))));
    candidates.push(...(pool.productKeywords ?? []));
    candidates.push(...(analysis.keywords ?? []));
  } else {
    candidates.push(...fallbackKeywords(analysis, runKeywords));
  }

  const seen = new Set<string>();
  const cleaned = candidates
    .map((k) => k.trim())
    .filter((k) => k.length >= 3 && !isGeneric(k))
    .filter((k) => {
      const key = k.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return cleaned
    .map((k) => ({ k, s: keywordScore(k) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, maxKeywords)
    .map((x) => x.k);
}

// V1.2:质量过滤由 evaluateYoutubeCandidateRelevance(相关性预评分)统一负责,替代旧的 passesQualityFilter/demoteRank。

export type AutoDiscoverInput = {
  discoveryRunId: number;
  analysis: WebsiteAnalysis;
  runKeywords?: string[];
  maxKeywords?: number;
  maxResultsPerKeyword?: number;
  maxCandidates?: number;
};

/**
 * 自动发现:选词 → 搜 YouTube → 质量过滤 → 本 run 去重 → 逐条写入拿 id → 自动评分。
 * 未启用/未配置返回 enabled:false;API 错误返回 error 文案,均不抛。
 */
export async function autoDiscoverYoutubeCandidates(input: AutoDiscoverInput): Promise<AutoDiscoverySummary> {
  const { discoveryRunId, analysis, runKeywords = [] } = input;
  const maxKeywords = Math.min(input.maxKeywords ?? 5, 5);
  const maxResultsPerKeyword = Math.min(Math.max(input.maxResultsPerKeyword ?? 12, 10), 15);
  const maxCandidates = Math.min(input.maxCandidates ?? 50, 50);

  const empty = { enabled: true, searchedKeywords: [] as string[], found: 0, qualified: 0, filtered: 0, created: 0, skipped: 0, scored: 0 };
  const status = getYoutubeStatus();
  if (!status.enabled || !status.configured) {
    return { ...empty, enabled: false };
  }

  const keywords = selectAutoSearchKeywords(analysis, maxKeywords, runKeywords);
  if (!keywords.length) {
    return { ...empty, error: "未能从画像中选出可用的搜索关键词" };
  }

  try {
    // 逐词搜索并合并
    const merged: ExternalCandidatePreview[] = [];
    for (const kw of keywords) {
      const results = await searchYoutubeCreators({ keyword: kw, maxResults: maxResultsPerKeyword });
      merged.push(...results);
    }
    const found = merged.length;

    // 相关性预评分:写入 rawData,按分数排序;仅 shouldImport(>=60) 进入自动导入
    const evaluated = merged.map((item) => {
      const rel = evaluateYoutubeCandidateRelevance(item, analysis);
      const rawData = { ...(item.rawData && typeof item.rawData === "object" ? item.rawData : {}), relevanceScore: rel.relevanceScore, relevanceReasons: rel.reasons, relevancePenalties: rel.penalties };
      return { item: { ...item, rawData }, rel };
    });
    const qualified = evaluated.filter((e) => e.rel.shouldImport).length;
    const filteredOut = evaluated.length - qualified;
    const importable = evaluated
      .filter((e) => e.rel.shouldImport)
      .sort((a, b) => b.rel.relevanceScore - a.rel.relevanceScore)
      .map((e) => e.item);

    // 本 run 去重(不跨 run)
    const existing = await prisma.influencerCandidate.findMany({
      where: { discoveryRunId },
      select: { profileUrl: true, rawDataJson: true },
    });
    const dedup = new RunDedup(existing);

    let skipped = 0;
    const toCreate: ExternalCandidatePreview[] = [];
    for (const item of importable) {
      if (toCreate.length >= maxCandidates) break;
      if (dedup.seen(item)) {
        skipped += 1;
        continue;
      }
      toCreate.push(item);
    }

    // createMany 拿不到 id → 循环 create(≤50),拿 id 后评分
    const brand = analysis;
    const createdIds: number[] = [];
    for (const item of toCreate) {
      const created = await prisma.influencerCandidate.create({ data: buildCandidateCreateInput(item, discoveryRunId) });
      createdIds.push(created.id);
    }

    let scored = 0;
    for (const cid of createdIds) {
      try {
        await scoreCandidateById(cid, brand);
        scored += 1;
      } catch {
        // 单个评分失败不影响整体
      }
    }

    return { enabled: true, searchedKeywords: keywords, found, qualified, filtered: filteredOut, created: createdIds.length, skipped, scored };
  } catch (error) {
    const message = error instanceof ExternalSourceError ? error.message : "YouTube 自动搜索失败";
    return { ...empty, searchedKeywords: keywords, error: message };
  }
}
