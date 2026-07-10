// 外部数据源 V1 —— 统一候选预览结构(当前仅 YouTube)

export type ExternalCandidatePreview = {
  platform: "youtube";
  externalId?: string; // YouTube channelId
  handle?: string | null;
  displayName?: string | null;
  profileUrl?: string | null;
  email?: string | null;
  country?: string | null;
  language?: string | null;
  followers?: number | null;
  avgViews?: number | null;
  avgLikes?: number | null;
  avgComments?: number | null;
  recentPostCount?: number | null;
  engagementRate?: number | null;
  nicheTags?: string[];
  matchedKeywords?: string[];
  contentSamples?: Array<{
    title?: string;
    url?: string;
    publishedAt?: string;
    views?: number | null;
    likes?: number | null;
    comments?: number | null;
  }>;
  rawData?: unknown;
};

export type YoutubeSearchInput = {
  keyword: string;
  maxResults?: number;
};

// 精简后写入 rawDataJson 的结构(不含大响应、不含 API key)
export type YoutubeRawData = {
  externalId: string;
  source: "youtube";
  searchKeyword: string;
  channelTitle: string;
  subscriberCount: number | null;
  sampleVideoIds: string[];
  fetchedAt: string;
};

// 外部数据源错误(携带可读文案与 HTTP 状态)
export class ExternalSourceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExternalSourceError";
    this.status = status;
  }
}
