// 确定性评分 —— 核心可解释,AI 只提供 hint,最终由后端 clamp + 重算 total。
// 满分 100,8 维度 + 风险扣分(0~-10)。

import {
  MAX_RISK_PENALTY,
  SCORE_WEIGHTS,
  type AiScoreHint,
  type CandidateScoringInput,
  type CandidateTier,
  type RecommendedOffer,
  type ScoreDetails,
  type ScoreResult,
  type WebsiteAnalysis,
} from "./types";

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

// AI hint 值:有限且非负则采用(再 clamp 到满分),否则回退基线
function pick(hint: number | undefined, baseline: number, max: number) {
  if (typeof hint === "number" && Number.isFinite(hint) && hint >= 0) {
    return clamp(Math.round(hint), 0, max);
  }
  return clamp(Math.round(baseline), 0, max);
}

function tierOf(score: number): CandidateTier {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}

// 推荐合作方式:先按分层,再结合成本已知度微调
function recommendedOfferOf(tier: CandidateTier, hasCost: boolean): RecommendedOffer {
  if (tier === "A") return hasCost ? "paid" : "affiliate";
  if (tier === "B") return hasCost ? "affiliate" : "gifted";
  if (tier === "C") return "nurture";
  return "reject";
}

// 关键词命中数(基于 niche 标签与品牌关键词/niche 的交集)
function keywordHitScore(candidate: CandidateScoringInput, brand?: WebsiteAnalysis) {
  if (!brand) return { contentFit: 12, ipProductFit: 8, matched: 0 };
  const brandTerms = new Set(
    [...brand.keywords, ...brand.creatorNiches, ...brand.primaryCategories]
      .map((t) => t.toLowerCase().trim())
      .filter(Boolean),
  );
  const candidateTerms = [...(candidate.nicheTags ?? []), ...(candidate.matchedKeywords ?? [])].map((t) =>
    t.toLowerCase().trim(),
  );
  const matched = candidateTerms.filter((t) => t && [...brandTerms].some((b) => b.includes(t) || t.includes(b))).length;
  // 命中越多,contentFit / ipProductFit 越高
  const contentFit = matched >= 3 ? 24 : matched === 2 ? 20 : matched === 1 ? 15 : 10;
  const ipProductFit = matched >= 3 ? 14 : matched === 2 ? 11 : matched === 1 ? 8 : 6;
  return { contentFit, ipProductFit, matched };
}

// 数据质量:关键字段齐全度
function dataQualityScore(c: CandidateScoringInput) {
  let filled = 0;
  const fields = [c.followers, c.avgViews, c.engagementRate, c.avgLikes, c.avgComments, c.recentPostCount];
  fields.forEach((f) => {
    if (typeof f === "number" && f > 0) filled += 1;
  });
  const ratio = filled / fields.length;
  return clamp(Math.round(ratio * SCORE_WEIGHTS.dataQuality), 0, SCORE_WEIGHTS.dataQuality);
}

// 互动质量:engagementRate(百分数值,如 3.5 表示 3.5%),或用点赞/播放比推算
function engagementScore(c: CandidateScoringInput) {
  let rate = typeof c.engagementRate === "number" ? c.engagementRate : null;
  if (rate === null && c.avgLikes && c.avgViews && c.avgViews > 0) {
    rate = (c.avgLikes / c.avgViews) * 100;
  }
  if (rate === null) return 5; // 未知给中性分
  // 3% 以上为优秀,给满分;线性映射
  if (rate >= 6) return SCORE_WEIGHTS.engagementQuality;
  if (rate >= 3) return 8;
  if (rate >= 1.5) return 6;
  if (rate >= 0.5) return 4;
  return 2;
}

// 受众匹配:候选国家是否落在品牌目标区域
function audienceScore(c: CandidateScoringInput, brand?: WebsiteAnalysis) {
  if (!brand || brand.targetRegions.length === 0) return 6; // 无目标区域信息 → 中性偏上
  if (!c.country) return 5;
  const regions = brand.targetRegions.map((r) => r.toLowerCase());
  const hit = regions.some((r) => r.includes(c.country!.toLowerCase()) || c.country!.toLowerCase().includes(r));
  return hit ? SCORE_WEIGHTS.audienceFit : 4;
}

// 商业转化潜力:粉丝体量 + 是否有商业化痕迹(播放量)
function commerceScore(c: CandidateScoringInput) {
  const followers = c.followers ?? 0;
  const views = c.avgViews ?? 0;
  let score = 4;
  if (followers >= 100_000 || views >= 100_000) score = 9;
  else if (followers >= 30_000 || views >= 30_000) score = 8;
  else if (followers >= 10_000 || views >= 10_000) score = 7; // 腰部/微网红转化常更佳
  else if (followers >= 3_000 || views >= 3_000) score = 6;
  return clamp(score, 0, SCORE_WEIGHTS.commercePotential);
}

// 成本效率:成本未知给中性分 5(硬约束第 10 条);已知成本时按体量粗估
function costEfficiencyScore(c: CandidateScoringInput) {
  if (!c.hasCost) return 5; // 报价未知 → 中性分,不给 0
  const followers = c.followers ?? 0;
  // 有成本信息时,粉丝越大性价比要求越高,这里给一个稳健中性偏上的分
  if (followers >= 10_000) return 7;
  return 6;
}

// 联系可达性:有邮箱或主页链接
function contactabilityScore(c: CandidateScoringInput) {
  let score = 0;
  if (c.email) score += 3;
  if (c.profileUrl) score += 2;
  return clamp(score, 0, SCORE_WEIGHTS.contactability);
}

// 风险扣分:数据严重缺失、无任何联系方式
function riskPenaltyScore(c: CandidateScoringInput) {
  let penalty = 0;
  const noMetrics = !c.followers && !c.avgViews && !c.engagementRate;
  if (noMetrics) penalty += 5;
  if (!c.email && !c.profileUrl) penalty += 3;
  if (!c.platform) penalty += 2;
  return clamp(penalty, 0, MAX_RISK_PENALTY);
}

/**
 * 确定性评分:先用规则算出基线各维度分,若有 AI hint 则以 hint 覆盖(clamp 到满分),
 * 最后由后端重新累加得到 total(绝不采用 AI 返回的 total)。
 */
export function scoreCandidate(candidate: CandidateScoringInput, brand?: WebsiteAnalysis, aiHint?: AiScoreHint): ScoreResult {
  const kw = keywordHitScore(candidate, brand);

  const baseline = {
    contentFit: kw.contentFit,
    ipProductFit: kw.ipProductFit,
    dataQuality: dataQualityScore(candidate),
    engagementQuality: engagementScore(candidate),
    audienceFit: audienceScore(candidate, brand),
    commercePotential: commerceScore(candidate),
    costEfficiency: costEfficiencyScore(candidate),
    contactability: contactabilityScore(candidate),
    riskPenalty: riskPenaltyScore(candidate),
  };

  const details: ScoreDetails = {
    contentFit: pick(aiHint?.contentFit, baseline.contentFit, SCORE_WEIGHTS.contentFit),
    ipProductFit: pick(aiHint?.ipProductFit, baseline.ipProductFit, SCORE_WEIGHTS.ipProductFit),
    dataQuality: pick(aiHint?.dataQuality, baseline.dataQuality, SCORE_WEIGHTS.dataQuality),
    engagementQuality: pick(aiHint?.engagementQuality, baseline.engagementQuality, SCORE_WEIGHTS.engagementQuality),
    audienceFit: pick(aiHint?.audienceFit, baseline.audienceFit, SCORE_WEIGHTS.audienceFit),
    commercePotential: pick(aiHint?.commercePotential, baseline.commercePotential, SCORE_WEIGHTS.commercePotential),
    costEfficiency: pick(aiHint?.costEfficiency, baseline.costEfficiency, SCORE_WEIGHTS.costEfficiency),
    contactability: pick(aiHint?.contactability, baseline.contactability, SCORE_WEIGHTS.contactability),
    riskPenalty: pick(aiHint?.riskPenalty, baseline.riskPenalty, MAX_RISK_PENALTY),
    total: 0,
  };

  // 后端重算 total,绝不信任 AI 的 total
  const positive =
    details.contentFit +
    details.ipProductFit +
    details.dataQuality +
    details.engagementQuality +
    details.audienceFit +
    details.commercePotential +
    details.costEfficiency +
    details.contactability;
  details.total = clamp(positive - details.riskPenalty, 0, 100);

  const tier = tierOf(details.total);
  const recommendedOffer = recommendedOfferOf(tier, Boolean(candidate.hasCost));

  const aiReason = typeof aiHint?.reason === "string" && aiHint.reason.trim() ? aiHint.reason.trim() : "";
  const riskNotes = Array.isArray(aiHint?.risks) ? aiHint!.risks.filter((r) => typeof r === "string" && r.trim()).slice(0, 3).join("；") : "";

  return { score: details.total, tier, recommendedOffer, scoreDetails: details, aiReason, riskNotes };
}
