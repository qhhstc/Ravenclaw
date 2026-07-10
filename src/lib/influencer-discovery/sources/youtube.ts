import "server-only";

import { ExternalSourceError, type ExternalCandidatePreview, type YoutubeRawData, type YoutubeSearchInput } from "./types";

// YouTube Data API v3 接入 V1 —— video-first 聚合:搜索视频 → 取统计 → 按 channelId 聚合成创作者候选。
// key 只在服务端使用,绝不打日志、绝不返回前端。

const API_BASE = "https://www.googleapis.com/youtube/v3";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_KEYWORD_LEN = 100;

function envValue(key: string) {
  return process.env[key]?.trim() || "";
}

export function getYoutubeStatus() {
  const key = envValue("YOUTUBE_API_KEY");
  const rawMax = Number(envValue("YOUTUBE_API_MAX_RESULTS"));
  const maxResults = Number.isFinite(rawMax) && rawMax > 0 ? Math.min(Math.floor(rawMax), 25) : 25;
  return {
    enabled: envValue("YOUTUBE_API_ENABLED") === "true",
    configured: Boolean(key),
    maxResults,
  };
}

function requireYoutubeConfig() {
  const status = getYoutubeStatus();
  if (!status.enabled || !status.configured) {
    throw new ExternalSourceError("YouTube 数据源未配置", 503);
  }
  return { key: envValue("YOUTUBE_API_KEY"), maxResults: status.maxResults };
}

type YoutubeErrorBody = { error?: { errors?: Array<{ reason?: string }>; message?: string } };

// 统一请求 + 错误文案转换(不泄露 key)
async function youtubeGet<T>(path: string, params: Record<string, string>, key: string, signal: AbortSignal): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set("key", key);

  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { accept: "application/json" } });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new ExternalSourceError("YouTube 请求超时,请稍后重试", 504);
    throw new ExternalSourceError("YouTube 请求失败,请检查网络", 502);
  }

  const body = (await response.json().catch(() => ({}))) as YoutubeErrorBody;
  if (!response.ok) {
    const reason = body.error?.errors?.[0]?.reason ?? "";
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded" || reason === "rateLimitExceeded") {
      throw new ExternalSourceError("YouTube API 配额不足，请稍后或更换 API Key", 429);
    }
    if (reason === "keyInvalid" || reason === "badRequest" || response.status === 400) {
      throw new ExternalSourceError("YouTube API Key 无效或请求参数有误", 400);
    }
    // 不透传上游原始 message(可能含内部信息),只记非 key 的 reason 到日志
    console.error(`[youtube] upstream error status=${response.status} reason=${reason}`);
    throw new ExternalSourceError("YouTube 服务暂时不可用，请稍后重试", 502);
  }
  return body as T;
}

type SearchItem = { id?: { videoId?: string }; snippet?: { channelId?: string; title?: string; publishedAt?: string } };
type VideoItem = { id?: string; snippet?: { channelId?: string; title?: string; publishedAt?: string }; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } };
type ChannelItem = {
  id?: string;
  snippet?: { title?: string; customUrl?: string; country?: string; defaultLanguage?: string };
  statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
};

function toInt(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function avg(nums: Array<number | null>): number | null {
  const valid = nums.filter((n): n is number => typeof n === "number");
  if (!valid.length) return null;
  return Math.round(valid.reduce((s, n) => s + n, 0) / valid.length);
}

/**
 * 按关键词搜索 YouTube 创作者。video-first:先搜视频再按 channelId 聚合,每频道 1 个候选。
 * 单个视频/频道缺字段不影响整体;失败抛 ExternalSourceError(带可读文案)。
 */
export async function searchYoutubeCreators({ keyword, maxResults }: YoutubeSearchInput): Promise<ExternalCandidatePreview[]> {
  const trimmed = (keyword ?? "").trim();
  if (!trimmed) throw new ExternalSourceError("请输入搜索关键词", 400);
  const kw = trimmed.slice(0, MAX_KEYWORD_LEN);

  const { key, maxResults: envMax } = requireYoutubeConfig();
  const limit = Math.min(Math.max(Math.floor(maxResults ?? envMax) || envMax, 1), 25);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // 1) search.list type=video
    const search = await youtubeGet<{ items?: SearchItem[] }>(
      "search",
      { part: "snippet", type: "video", q: kw, maxResults: String(limit), order: "relevance" },
      key,
      controller.signal,
    );
    const searchItems = search.items ?? [];
    const videoIds = [...new Set(searchItems.map((it) => it.id?.videoId).filter((v): v is string => Boolean(v)))];
    if (!videoIds.length) return [];

    // 2) videos.list 取统计
    const videosRes = await youtubeGet<{ items?: VideoItem[] }>(
      "videos",
      { part: "snippet,statistics", id: videoIds.join(",") },
      key,
      controller.signal,
    );
    const videos = videosRes.items ?? [];

    // 按 channelId 聚合样本视频
    const byChannel = new Map<string, VideoItem[]>();
    for (const v of videos) {
      const cid = v.snippet?.channelId;
      if (!cid) continue;
      const arr = byChannel.get(cid) ?? [];
      arr.push(v);
      byChannel.set(cid, arr);
    }
    const channelIds = [...byChannel.keys()];
    if (!channelIds.length) return [];

    // 3) channels.list 取频道信息
    const channelsRes = await youtubeGet<{ items?: ChannelItem[] }>(
      "channels",
      { part: "snippet,statistics,contentDetails", id: channelIds.join(",") },
      key,
      controller.signal,
    );
    const channelMap = new Map<string, ChannelItem>();
    for (const c of channelsRes.items ?? []) {
      if (c.id) channelMap.set(c.id, c);
    }

    const fetchedAt = new Date().toISOString();

    // 4) 聚合为候选(每频道 1 个)
    return channelIds.map((channelId) => {
      const samples = byChannel.get(channelId) ?? [];
      const channel = channelMap.get(channelId);
      const views = samples.map((v) => toInt(v.statistics?.viewCount));
      const likes = samples.map((v) => toInt(v.statistics?.likeCount));
      const comments = samples.map((v) => toInt(v.statistics?.commentCount));
      const avgViews = avg(views);
      const avgLikes = avg(likes);
      const avgComments = avg(comments);
      const engagementRate =
        avgViews && avgViews > 0 ? Number(((((avgLikes ?? 0) + (avgComments ?? 0)) / avgViews) * 100).toFixed(4)) : null;
      const subscriberCount = channel?.statistics?.hiddenSubscriberCount ? null : toInt(channel?.statistics?.subscriberCount);
      const channelTitle = channel?.snippet?.title ?? "";
      const handle = channel?.snippet?.customUrl || channelTitle || null;
      const sampleVideoIds = samples.map((v) => v.id).filter((v): v is string => Boolean(v));

      const rawData: YoutubeRawData = {
        externalId: channelId,
        source: "youtube",
        searchKeyword: kw,
        channelTitle,
        subscriberCount,
        sampleVideoIds,
        fetchedAt,
      };

      return {
        platform: "youtube",
        externalId: channelId,
        handle,
        displayName: channelTitle || handle || channelId,
        profileUrl: `https://www.youtube.com/channel/${channelId}`,
        email: null,
        country: channel?.snippet?.country ?? null,
        language: channel?.snippet?.defaultLanguage ?? null,
        followers: subscriberCount,
        avgViews,
        avgLikes,
        avgComments,
        recentPostCount: samples.length || null,
        engagementRate,
        nicheTags: [],
        matchedKeywords: [kw],
        contentSamples: samples.map((v) => ({
          title: v.snippet?.title,
          url: v.id ? `https://www.youtube.com/watch?v=${v.id}` : undefined,
          publishedAt: v.snippet?.publishedAt,
          views: toInt(v.statistics?.viewCount),
          likes: toInt(v.statistics?.likeCount),
          comments: toInt(v.statistics?.commentCount),
        })),
        rawData,
      } satisfies ExternalCandidatePreview;
    });
  } finally {
    clearTimeout(timer);
  }
}
