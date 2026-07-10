import { Prisma } from "@prisma/client";
import type { ExternalCandidatePreview } from "./types";

// 外部数据源候选 → InfluencerCandidate 写入字段的共享映射与去重(import 路由与 auto-discovery 共用,避免漂移)

export function optionalInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

// 从预览项取去重用 externalId(优先顶层,回退 rawData.externalId)
export function externalIdOf(item: ExternalCandidatePreview): string | null {
  if (item.externalId) return item.externalId;
  const raw = item.rawData;
  if (raw && typeof raw === "object" && "externalId" in raw) {
    const val = (raw as { externalId?: unknown }).externalId;
    if (typeof val === "string" && val) return val;
  }
  return null;
}

// 从已存在候选记录的 rawDataJson 取 externalId
export function existingExternalId(rawDataJson: Prisma.JsonValue | null): string | null {
  if (rawDataJson && typeof rawDataJson === "object" && !Array.isArray(rawDataJson) && "externalId" in rawDataJson) {
    const val = (rawDataJson as Record<string, unknown>).externalId;
    if (typeof val === "string" && val) return val;
  }
  return null;
}

// 预览项 → createMany/create 的输入字段(source=youtube_api, status=new)
export function buildCandidateCreateInput(item: ExternalCandidatePreview, discoveryRunId: number): Prisma.InfluencerCandidateCreateManyInput {
  const tags = Array.isArray(item.nicheTags) ? item.nicheTags.filter((t) => typeof t === "string" && t.trim()) : [];
  const matched = Array.isArray(item.matchedKeywords) ? item.matchedKeywords.filter((t) => typeof t === "string" && t.trim()) : [];
  const engagementRate =
    typeof item.engagementRate === "number" && Number.isFinite(item.engagementRate) && item.engagementRate >= 0
      ? new Prisma.Decimal(item.engagementRate.toFixed(4))
      : null;
  return {
    discoveryRunId,
    platform: "youtube",
    handle: item.handle ?? null,
    displayName: item.displayName ?? null,
    profileUrl: item.profileUrl ?? null,
    email: item.email ?? null,
    country: item.country ?? null,
    language: item.language ?? null,
    followers: optionalInt(item.followers),
    avgViews: optionalInt(item.avgViews),
    avgLikes: optionalInt(item.avgLikes),
    avgComments: optionalInt(item.avgComments),
    recentPostCount: optionalInt(item.recentPostCount),
    engagementRate,
    nicheTagsJson: tags.length ? (tags as Prisma.InputJsonValue) : Prisma.DbNull,
    matchedKeywordsJson: matched.length ? (matched as Prisma.InputJsonValue) : Prisma.DbNull,
    contentSamplesJson: item.contentSamples?.length ? (item.contentSamples as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
    rawDataJson: item.rawData ? (item.rawData as Prisma.InputJsonValue) : Prisma.DbNull,
    source: "youtube_api",
    status: "new",
  };
}

// 本 run 内去重器(profileUrl 优先、externalId 回退;同批内也去重)。不跨 run。
export class RunDedup {
  private urls: Set<string>;
  private ids: Set<string>;

  constructor(existing: Array<{ profileUrl: string | null; rawDataJson: Prisma.JsonValue | null }>) {
    this.urls = new Set(existing.map((e) => e.profileUrl).filter((v): v is string => Boolean(v)));
    this.ids = new Set(existing.map((e) => existingExternalId(e.rawDataJson)).filter((v): v is string => Boolean(v)));
  }

  // 返回 true 表示已存在(应跳过);否则登记并返回 false
  seen(item: ExternalCandidatePreview): boolean {
    const externalId = externalIdOf(item);
    if (!item.profileUrl && !externalId && !item.displayName) return true; // 无有效标识,视为跳过
    if (item.profileUrl && this.urls.has(item.profileUrl)) return true;
    if (externalId && this.ids.has(externalId)) return true;
    if (item.profileUrl) this.urls.add(item.profileUrl);
    if (externalId) this.ids.add(externalId);
    return false;
  }
}
