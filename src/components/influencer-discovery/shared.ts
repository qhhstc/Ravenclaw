// 红人发现前端共享:fetch 封装、选项常量、格式化

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(data.message || "请求失败");
  return data;
}

export const runStatusMeta: Record<string, { label: string; color: string }> = {
  pending: { label: "待分析", color: "default" },
  analyzing: { label: "分析中", color: "processing" },
  completed: { label: "已完成", color: "success" },
  failed: { label: "失败", color: "error" },
};

export const candidateStatusMeta: Record<string, { label: string; color: string }> = {
  new: { label: "待评分", color: "default" },
  scored: { label: "已评分", color: "blue" },
  approved: { label: "已通过", color: "green" },
  rejected: { label: "已拒绝", color: "red" },
  contacted: { label: "已联系", color: "cyan" },
  collaboration: { label: "已转合作", color: "purple" },
  blacklisted: { label: "黑名单", color: "volcano" },
};

export const tierColor: Record<string, string> = { A: "green", B: "blue", C: "orange", D: "default" };

export const offerLabel: Record<string, string> = {
  paid: "付费合作",
  gifted: "寄样合作",
  affiliate: "联盟分销",
  nurture: "长期培育",
  reject: "不推荐",
};

export const candidateStatusOptions = Object.entries(candidateStatusMeta).map(([value, m]) => ({ value, label: m.label }));
export const tierOptions = ["A", "B", "C", "D"].map((v) => ({ value: v, label: `${v} 级` }));
export const platformOptions = ["Instagram", "TikTok", "YouTube", "Facebook", "Pinterest", "Blog", "Other"].map((v) => ({ label: v, value: v }));

export function shortNumber(value?: number | null) {
  if (value === null || value === undefined) return "-";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function rateText(value?: number | null) {
  return value === null || value === undefined ? "-" : `${value}%`;
}

export type CandidateRecord = {
  id: number;
  discoveryRunId: number | null;
  platform: string | null;
  handle: string | null;
  displayName: string | null;
  profileUrl: string | null;
  email: string | null;
  country: string | null;
  language: string | null;
  followers: number | null;
  avgViews: number | null;
  engagementRate: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  recentPostCount: number | null;
  nicheTags: string[];
  matchedKeywords: string[];
  score: number | null;
  tier: string | null;
  recommendedOffer: string | null;
  recommendedProducts: string | null;
  scoreDetailsJson: Record<string, number> | null;
  aiReason: string | null;
  riskNotes: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  discoveryRun?: { id: number; websiteUrl: string; brandName: string | null } | null;
};

export type AutoDiscoverySummary = {
  enabled: boolean;
  searchedKeywords: string[];
  found: number;
  created: number;
  skipped: number;
  scored: number;
  error?: string;
};

export type RunRecord = {
  id: number;
  websiteUrl: string;
  websiteDomain: string | null;
  status: string;
  brandName: string | null;
  brandSummary: string | null;
  productSummary: string | null;
  audienceSummary: string | null;
  creatorPersona: string | null;
  keywordsJson: Record<string, string[]> | null;
  analysisJson: { youtubeAutoDiscovery?: AutoDiscoverySummary } | null;
  errorMessage: string | null;
  candidateCount: number;
  createdBy: { id: number; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
};
