// 红人发现与评分 V1 —— 共享类型与状态常量(不使用 enum,全部用 string 常量约束)

export const DISCOVERY_RUN_STATUSES = ["pending", "analyzing", "completed", "failed"] as const;
export type DiscoveryRunStatus = (typeof DISCOVERY_RUN_STATUSES)[number];

export const CANDIDATE_STATUSES = [
  "new",
  "scored",
  "approved",
  "rejected",
  "contacted",
  "collaboration",
  "blacklisted",
] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const CANDIDATE_SOURCES = ["manual", "csv", "website_analysis", "youtube_api", "imported"] as const;
export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];

export const CANDIDATE_TIERS = ["A", "B", "C", "D"] as const;
export type CandidateTier = (typeof CANDIDATE_TIERS)[number];

export const RECOMMENDED_OFFERS = ["paid", "gifted", "affiliate", "nurture", "reject"] as const;
export type RecommendedOffer = (typeof RECOMMENDED_OFFERS)[number];

export const CANDIDATE_PLATFORMS = ["Instagram", "TikTok", "YouTube", "Facebook", "Pinterest", "Blog", "Other"] as const;

// 网站抓取后的结构化文本(交给 AI 分析用)
export type WebsiteContent = {
  finalUrl: string;
  domain: string;
  pageTitle: string;
  metaDescription: string;
  headings: string[];
  navigationTexts: string[];
  productTexts: string[];
  collectionTexts: string[];
  bodyText: string;
};

// AI(或 fallback)输出的网站/品牌/红人画像分析结果
export type WebsiteAnalysis = {
  brandName: string;
  brandSummary: string;
  productSummary: string;
  audienceSummary: string;
  creatorPersona: string;
  primaryCategories: string[];
  priceBands: string[];
  targetRegions: string[];
  creatorNiches: string[];
  platforms: string[];
  keywords: string[];
  negativeKeywords: string[];
  recommendedOfferTypes: string[];
  notes: string[];
  // 分层关键词池(V1.1),供自动搜索选词;旧 run 可能无此字段,消费方需兜底
  keywordPool?: KeywordPool;
  // 是否由 AI 生成(false = 走了 fallback 规则化画像)
  aiGenerated: boolean;
};

export type KeywordPool = {
  highIntentKeywords: string[]; // 高购买/开箱意图,如 anime figure unboxing
  ipKeywords: string[]; // IP 精准,如 Genshin Impact merch
  contentFormatKeywords: string[]; // 内容形式,如 unboxing / review / haul
  creatorNicheKeywords: string[]; // 红人类型,如 figure collector / toy reviewer
  negativeKeywords: string[]; // 排除,如 official trailer / AMV / reaction
};

// 评分明细(8 维度 + 风险扣分,total 由后端重算)
export type ScoreDetails = {
  contentFit: number; // 0-25
  ipProductFit: number; // 0-15
  dataQuality: number; // 0-15
  engagementQuality: number; // 0-10
  audienceFit: number; // 0-10
  commercePotential: number; // 0-10
  costEfficiency: number; // 0-10
  contactability: number; // 0-5
  riskPenalty: number; // 0-10 (以正数记录扣分绝对值)
  total: number; // 0-100
};

export type ScoreResult = {
  score: number;
  tier: CandidateTier;
  recommendedOffer: RecommendedOffer;
  scoreDetails: ScoreDetails;
  aiReason: string;
  riskNotes: string;
};

// 各维度满分(scoring.ts 与 ai.ts 共用)
export const SCORE_WEIGHTS = {
  contentFit: 25,
  ipProductFit: 15,
  dataQuality: 15,
  engagementQuality: 10,
  audienceFit: 10,
  commercePotential: 10,
  costEfficiency: 10,
  contactability: 5,
} as const;

export const MAX_RISK_PENALTY = 10;

// 候选红人评分所需的输入快照(来自 DB 记录,字段全部可空)
export type CandidateScoringInput = {
  platform?: string | null;
  handle?: string | null;
  displayName?: string | null;
  profileUrl?: string | null;
  email?: string | null;
  country?: string | null;
  language?: string | null;
  followers?: number | null;
  avgViews?: number | null;
  engagementRate?: number | null;
  avgLikes?: number | null;
  avgComments?: number | null;
  recentPostCount?: number | null;
  nicheTags?: string[];
  matchedKeywords?: string[];
  hasCost?: boolean; // 是否已知报价成本(用于 costEfficiency 中性分逻辑)
};

// AI 评分辅助结果(不可信,仅作 hint,后端会 clamp 并重算 total)
export type AiScoreHint = Partial<Omit<ScoreDetails, "total">> & {
  reason?: string;
  risks?: string[];
};
