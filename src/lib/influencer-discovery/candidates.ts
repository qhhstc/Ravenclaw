import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { toNumber } from "@/lib/order-profit-calculations";
import { ApiAuthError } from "@/lib/permissions";
import { CANDIDATE_PLATFORMS, CANDIDATE_STATUSES, type CandidateScoringInput, type WebsiteAnalysis } from "./types";

export function apiError(error: unknown, fallback = "红人发现操作失败") {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return NextResponse.json({ message: "记录不存在或已删除" }, { status: 404 });
  }
  return NextResponse.json({ message: error instanceof Error ? error.message : fallback }, { status: 400 });
}

export function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function optionalInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : null;
}

export function optionalRate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).replace(/%/g, ""));
  return Number.isFinite(numeric) && numeric >= 0 ? Number(numeric.toFixed(4)) : null;
}

export function jsonToStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

// 候选红人序列化:Decimal 转 number,Json 转数组,避免前端渲染 Prisma.Decimal 对象
type CandidateRecord = Prisma.InfluencerCandidateGetPayload<{ include: { discoveryRun: { select: { id: true; websiteUrl: true; brandName: true } } } }>;

export function serializeCandidate(candidate: CandidateRecord) {
  return {
    ...candidate,
    engagementRate: candidate.engagementRate === null ? null : toNumber(candidate.engagementRate),
    nicheTags: jsonToStringArray(candidate.nicheTagsJson),
    matchedKeywords: jsonToStringArray(candidate.matchedKeywordsJson),
    createdAt: candidate.createdAt.toISOString(),
    updatedAt: candidate.updatedAt.toISOString(),
  };
}

export const candidateInclude = {
  discoveryRun: { select: { id: true, websiteUrl: true, brandName: true } },
} satisfies Prisma.InfluencerCandidateInclude;

// 分析任务序列化(含创建人与候选计数)
type RunRecord = Prisma.InfluencerDiscoveryRunGetPayload<{
  include: { createdBy: { select: { id: true; name: true; email: true } }; _count: { select: { candidates: true } } };
}>;

export function serializeRun(run: RunRecord) {
  return {
    id: run.id,
    websiteUrl: run.websiteUrl,
    websiteDomain: run.websiteDomain,
    status: run.status,
    source: run.source,
    brandName: run.brandName,
    brandSummary: run.brandSummary,
    productSummary: run.productSummary,
    audienceSummary: run.audienceSummary,
    creatorPersona: run.creatorPersona,
    keywordsJson: run.keywordsJson,
    analysisJson: run.analysisJson,
    errorMessage: run.errorMessage,
    candidateCount: run._count.candidates,
    createdBy: run.createdBy,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

export const runInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  _count: { select: { candidates: true } },
} satisfies Prisma.InfluencerDiscoveryRunInclude;

// 归一化手工新增/编辑候选红人的输入
export function normalizeCandidateInput(input: Record<string, unknown>, source = "manual") {
  const platformRaw = textValue(input.platform);
  const platform = platformRaw
    ? CANDIDATE_PLATFORMS.find((p) => p.toLowerCase() === platformRaw.toLowerCase()) ?? platformRaw
    : null;
  const profileUrl = textValue(input.profileUrl);
  if (profileUrl && !/^https?:\/\//i.test(profileUrl)) throw new Error("主页链接必须以 http:// 或 https:// 开头");
  const email = textValue(input.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("邮箱格式不正确");
  const handle = textValue(input.handle);
  const displayName = textValue(input.displayName);
  if (!handle && !profileUrl && !displayName) throw new Error("账号、主页链接、名称至少填写一项(仅有平台无法定位红人)");

  const nicheTags = Array.isArray(input.nicheTags)
    ? input.nicheTags.filter((t): t is string => typeof t === "string" && t.trim() !== "").map((t) => t.trim())
    : textValue(input.nicheTags)
      ? String(input.nicheTags)
          .split(/[;,、|]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

  return {
    platform,
    handle,
    displayName,
    profileUrl,
    email,
    country: textValue(input.country)?.toUpperCase() ?? null,
    language: textValue(input.language),
    followers: optionalInt(input.followers),
    avgViews: optionalInt(input.avgViews),
    engagementRate: optionalRate(input.engagementRate),
    avgLikes: optionalInt(input.avgLikes),
    avgComments: optionalInt(input.avgComments),
    recentPostCount: optionalInt(input.recentPostCount),
    nicheTagsJson: nicheTags.length ? (nicheTags as Prisma.InputJsonValue) : Prisma.DbNull,
    notes: textValue(input.notes),
    source,
  };
}

// 从 DB 候选记录构建评分输入
export function toScoringInput(candidate: {
  platform: string | null;
  handle: string | null;
  displayName: string | null;
  profileUrl: string | null;
  email: string | null;
  country: string | null;
  language: string | null;
  followers: number | null;
  avgViews: number | null;
  engagementRate: Prisma.Decimal | number | null;
  avgLikes: number | null;
  avgComments: number | null;
  recentPostCount: number | null;
  nicheTagsJson: Prisma.JsonValue | null;
  matchedKeywordsJson: Prisma.JsonValue | null;
}): CandidateScoringInput {
  return {
    platform: candidate.platform,
    handle: candidate.handle,
    displayName: candidate.displayName,
    profileUrl: candidate.profileUrl,
    email: candidate.email,
    country: candidate.country,
    language: candidate.language,
    followers: candidate.followers,
    avgViews: candidate.avgViews,
    engagementRate: candidate.engagementRate === null ? null : toNumber(candidate.engagementRate),
    avgLikes: candidate.avgLikes,
    avgComments: candidate.avgComments,
    recentPostCount: candidate.recentPostCount,
    nicheTags: jsonToStringArray(candidate.nicheTagsJson),
    matchedKeywords: jsonToStringArray(candidate.matchedKeywordsJson),
    hasCost: false, // V1 候选红人暂无报价字段,成本未知 → scoring 给中性分
  };
}

export function buildCandidateWhere(params: URLSearchParams): Prisma.InfluencerCandidateWhereInput {
  const keyword = params.get("keyword")?.trim();
  const status = params.get("status");
  const tier = params.get("tier");
  const platform = params.get("platform");
  const minScore = Number(params.get("minScore"));
  const discoveryRunId = Number(params.get("discoveryRunId"));
  return {
    ...(keyword
      ? {
          OR: [
            { handle: { contains: keyword } },
            { displayName: { contains: keyword } },
            { profileUrl: { contains: keyword } },
            { email: { contains: keyword } },
            { country: { contains: keyword } },
          ],
        }
      : {}),
    ...(status && CANDIDATE_STATUSES.includes(status as (typeof CANDIDATE_STATUSES)[number]) ? { status } : {}),
    ...(tier ? { tier } : {}),
    ...(platform ? { platform } : {}),
    ...(Number.isFinite(minScore) && minScore > 0 ? { score: { gte: Math.floor(minScore) } } : {}),
    ...(Number.isInteger(discoveryRunId) && discoveryRunId > 0 ? { discoveryRunId } : {}),
  };
}

// 把 run 的 keywordsJson/analysis 还原为 WebsiteAnalysis(供评分作品牌画像输入)
export function runToBrandAnalysis(run: {
  brandName: string | null;
  brandSummary: string | null;
  productSummary: string | null;
  audienceSummary: string | null;
  creatorPersona: string | null;
  keywordsJson: Prisma.JsonValue | null;
} | null): WebsiteAnalysis | undefined {
  if (!run) return undefined;
  const kw = (run.keywordsJson && typeof run.keywordsJson === "object" && !Array.isArray(run.keywordsJson) ? run.keywordsJson : {}) as Record<string, Prisma.JsonValue>;
  return {
    brandName: run.brandName ?? "",
    brandSummary: run.brandSummary ?? "",
    productSummary: run.productSummary ?? "",
    audienceSummary: run.audienceSummary ?? "",
    creatorPersona: run.creatorPersona ?? "",
    primaryCategories: jsonToStringArray(kw.primaryCategories),
    priceBands: jsonToStringArray(kw.priceBands),
    targetRegions: jsonToStringArray(kw.targetRegions),
    creatorNiches: jsonToStringArray(kw.creatorNiches),
    platforms: jsonToStringArray(kw.platforms),
    keywords: jsonToStringArray(kw.keywords),
    negativeKeywords: jsonToStringArray(kw.negativeKeywords),
    recommendedOfferTypes: jsonToStringArray(kw.recommendedOfferTypes),
    notes: [],
    aiGenerated: true,
  };
}

const SORT_FIELDS: Record<string, Prisma.InfluencerCandidateOrderByWithRelationInput> = {
  score: { score: "desc" },
  followers: { followers: "desc" },
  avgViews: { avgViews: "desc" },
  updatedAt: { updatedAt: "desc" },
};

export function buildCandidateOrderBy(sort: string | null): Prisma.InfluencerCandidateOrderByWithRelationInput[] {
  const primary = (sort && SORT_FIELDS[sort]) || SORT_FIELDS.score;
  return [primary, { id: "desc" }];
}
