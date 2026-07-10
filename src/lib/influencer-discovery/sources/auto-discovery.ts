import "server-only";

import { prisma } from "@/lib/prisma";
import { scoreCandidateById } from "@/lib/influencer-discovery/score-runner";
import type { KeywordPool, WebsiteAnalysis } from "@/lib/influencer-discovery/types";
import { ExternalSourceError, type ExternalCandidatePreview } from "./types";
import { getYoutubeStatus, searchYoutubeCreators } from "./youtube";
import { buildCandidateCreateInput, RunDedup } from "./candidate-import";

export type AutoDiscoverySummary = {
  enabled: boolean;
  searchedKeywords: string[];
  found: number;
  created: number;
  skipped: number;
  scored: number;
  error?: string;
  ranAt?: string;
};

// 加权/降权词表
const BOOST_TERMS = ["merch", "unboxing", "haul", "review", "figure", "plush", "blind box", "cosplay", "genshin", "honkai", "zenless", "wuthering waves"];
const GENERIC_TERMS = ["anime", "game", "cute", "gift", "official", "best"];
const INTENT_TERMS = ["unboxing", "haul", "review", "merch", "collection", "blind box"];
// 明显要硬排除的官方/非红人内容
const HARD_EXCLUDE = ["official trailer", "music video", "mv"];
// 降权(不硬删)的内容类型
const SOFT_DEMOTE = ["reaction", "gameplay only", "gameplay", "news", "amv"];

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
  if (pool && (pool.highIntentKeywords.length || pool.ipKeywords.length)) {
    candidates.push(...pool.highIntentKeywords);
    candidates.push(...pool.ipKeywords.filter((k) => BOOST_TERMS.some((t) => k.toLowerCase().includes(t))));
    candidates.push(...pool.ipKeywords);
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

// 轻量质量过滤:硬排除官方/trailer/MV;命中判定放宽(频道名/视频标题/样本标题/matchedKeywords 任一命中即可)
function passesQualityFilter(item: ExternalCandidatePreview, keywords: string[]): boolean {
  if (!item.externalId && !item.profileUrl) return false;
  const title = (item.displayName ?? "").toLowerCase();
  const handle = (item.handle ?? "").toLowerCase();
  const sampleTitles = (item.contentSamples ?? []).map((s) => (s.title ?? "").toLowerCase()).join(" ");
  const haystack = `${title} ${handle} ${sampleTitles}`;

  // 硬排除:明显官方/预告/MV(标题里成对出现)
  if (HARD_EXCLUDE.some((t) => haystack.includes(t))) return false;

  // 命中放宽:matchedKeywords 或任一文本命中任一关键词的任一词根
  const kwTokens = keywords.flatMap((k) => k.toLowerCase().split(/\s+/)).filter((t) => t.length >= 3 && !GENERIC_TERMS.includes(t));
  const matched = (item.matchedKeywords ?? []).length > 0;
  const hit = matched || kwTokens.some((t) => haystack.includes(t));
  return hit; // 不因未完全命中就丢;只要有任一命中(含 matchedKeywords)即保留
}

// 降权排序:reaction/gameplay/news/AMV 往后排(不删除)
function demoteRank(item: ExternalCandidatePreview): number {
  const haystack = `${item.displayName ?? ""} ${(item.contentSamples ?? []).map((s) => s.title ?? "").join(" ")}`.toLowerCase();
  let penalty = 0;
  if (SOFT_DEMOTE.some((t) => haystack.includes(t))) penalty += 2;
  if ((item.avgViews ?? 0) === 0 && (item.followers ?? 0) === 0) penalty += 1; // 数据全缺降权
  return penalty;
}

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

  const status = getYoutubeStatus();
  if (!status.enabled || !status.configured) {
    return { enabled: false, searchedKeywords: [], found: 0, created: 0, skipped: 0, scored: 0 };
  }

  const keywords = selectAutoSearchKeywords(analysis, maxKeywords, runKeywords);
  if (!keywords.length) {
    return { enabled: true, searchedKeywords: [], found: 0, created: 0, skipped: 0, scored: 0, error: "未能从画像中选出可用的搜索关键词" };
  }

  try {
    // 逐词搜索并合并
    const merged: ExternalCandidatePreview[] = [];
    for (const kw of keywords) {
      const results = await searchYoutubeCreators({ keyword: kw, maxResults: maxResultsPerKeyword });
      merged.push(...results);
    }
    const found = merged.length;

    // 质量过滤 + 降权排序
    const filtered = merged
      .filter((it) => passesQualityFilter(it, keywords))
      .sort((a, b) => demoteRank(a) - demoteRank(b));

    // 本 run 去重(不跨 run)
    const existing = await prisma.influencerCandidate.findMany({
      where: { discoveryRunId },
      select: { profileUrl: true, rawDataJson: true },
    });
    const dedup = new RunDedup(existing);

    let skipped = 0;
    const toCreate: ExternalCandidatePreview[] = [];
    for (const item of filtered) {
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

    return { enabled: true, searchedKeywords: keywords, found, created: createdIds.length, skipped, scored };
  } catch (error) {
    const message = error instanceof ExternalSourceError ? error.message : "YouTube 自动搜索失败";
    return { enabled: true, searchedKeywords: keywords, found: 0, created: 0, skipped: 0, scored: 0, error: message };
  }
}
