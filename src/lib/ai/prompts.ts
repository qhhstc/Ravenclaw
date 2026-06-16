import { businessBlockLabel } from "@/lib/business-blocks";

export type AiAnalysisResult = {
  rating: "S" | "A" | "B" | "C" | null;
  ratingReason: string;
  confidence: "high" | "medium" | "low";
  summary: string;
  riskNotes: string[];
  actionSuggestion: string;
  budgetSuggestion: { nextBudget: number; reason: string } | null;
};

export type CompanyReviewResult = {
  overallRating: "S" | "A" | "B" | "C" | null;
  overallSummary: string;
  topPriority: string;
  capitalShiftSuggestion: string;
  confidence: "high" | "medium" | "low";
  riskNotes: string[];
};

export type ChannelAnalysisPromptInput = {
  year: number;
  month: number;
  businessBlock?: string | null;
  channelName: string;
  currency?: string | null;
  weeks: Array<{ weekNumber: number; salesAmount: number; adSpend: number }>;
  monthSales: number;
  monthAdSpend: number;
  roi: number | null;
  adSpendRatio: number | null;
  salesShare: number | null;
  productCost: number;
  otherCost: number;
  grossProfit: number;
  grossMargin: number | null;
  monthOverMonth: number | null;
  roiMonthOverMonth: number | null;
  grossMarginMonthOverMonth: number | null;
  adSpendMonthOverMonth: number | null;
  quarterSales: number | null;
  quarterAdSpend: number | null;
  dataCoverage: { filledWeeks: number; totalWeeks: number; hasCost: boolean; hasPreviousMonth: boolean };
  manualRating?: string | null;
  remark?: string | null;
  decisionOwner?: string | null;
  decisionDeadline?: string | null;
};

export type BusinessBlockAnalysisPromptInput = {
  year: number;
  month: number;
  blocks: Array<{
    businessBlock: string;
    blockName: string;
    salesAmount: number;
    salesShare: number | null;
    adSpend: number;
    grossProfit: number;
    grossMargin: number | null;
    roi: number | null;
    monthOverMonth: number | null;
    currentAdSpend: number;
    nextBudget: number | null;
    remark?: string | null;
  }>;
};

export type CompanyReviewPromptInput = {
  year: number;
  month: number;
  totals: {
    salesAmount: number;
    adSpend: number;
    grossProfit: number;
    grossMargin: number | null;
    roi: number | null;
  };
  blocks: Array<{
    blockName: string;
    salesAmount: number;
    salesShare: number | null;
    adSpend: number;
    grossProfit: number;
    grossMargin: number | null;
    roi: number | null;
    monthOverMonth: number | null;
  }>;
};

export const aiJsonSchemaHint = `{
  "rating": "S" | "A" | "B" | "C" | null,
  "ratingReason": "评级依据:命中哪条标准、关键数字(如 ROI 2.1 低于健康线 3)",
  "confidence": "high" | "medium" | "low",
  "summary": "2-3 句总结,必须引用关键指标数值与对比(销售额/ROI/毛利率/环比)",
  "riskNotes": ["风险1", "风险2"],
  "actionSuggestion": "具体可执行的建议动作",
  "budgetSuggestion": { "nextBudget": 0, "reason": "预算调整原因" } | null
}`;

export const companyReviewSchemaHint = `{
  "overallRating": "S" | "A" | "B" | "C" | null,
  "overallSummary": "2-4 句公司本月整体经营评价,引用总销售额/总毛利/整体ROI等关键数字",
  "topPriority": "下个月第一优先要做的事(一句话,具体)",
  "capitalShiftSuggestion": "跨板块预算挪动建议(如:建议把独立站约20%广告预算挪到Amazon),无明显建议则说明维持现状",
  "confidence": "high" | "medium" | "low",
  "riskNotes": ["公司层面风险1", "风险2"]
}`;

export const aiSystemPrompt = `你是一个跨境电商经营分析助手，帮助管理者分析渠道效率、经营毛利、ROI、广告占销和预算动作。
所有金额单位均为人民币本位币(CNY)。只能输出严格 JSON，不要输出 Markdown，不要在 JSON 之外输出任何文字。
不要编造没有的数据。数据不足时要明确说明，并把 confidence 设为 low、rating 设为 null。
不要因为广告为 0 就直接判差，需要结合自然流量、SEO、EDM、老客户等渠道特征。
评级标准仅作参考，不要绝对化：S=ROI高、毛利率高、增长好；A=表现健康，可继续投入；B=表现一般，需要观察或优化；C=风险较高，需要收缩、排查或暂停。
summary 必须是 2-3 句、引用具体指标数值与对比(例如"ROI 2.1 低于健康线 3、毛利率较上月降 5pct、主因广告占销升至 28%")，不要输出"表现一般"这类无数字的空话。
ratingReason 必须说明该评级命中了哪条标准、依据哪些关键数字。
confidence 根据数据完整度判断:数据齐全且有可比项=high，部分缺失=medium，明显不足=low。
风险提示不超过 3 条。建议动作要具体、可执行。预算建议要保守，不要夸张。`;

export function buildChannelAnalysisPrompt(input: ChannelAnalysisPromptInput) {
  return `请分析以下渠道效率数据，并只返回符合结构的 JSON。所有金额单位为人民币本位币(CNY)。

数据：
${JSON.stringify(
    {
      年份: input.year,
      月份: input.month,
      板块: businessBlockLabel(input.businessBlock),
      渠道名称: input.channelName,
      币种说明: "以下金额均为 CNY 本位币",
      W1_W5: input.weeks,
      月销售额: input.monthSales,
      月广告费: input.monthAdSpend,
      ROI: input.roi,
      广告占销: input.adSpendRatio,
      销售占比: input.salesShare,
      销售额环比上月: input.monthOverMonth,
      ROI环比上月: input.roiMonthOverMonth,
      广告费环比上月: input.adSpendMonthOverMonth,
      本季度累计销售: input.quarterSales,
      本季度累计广告: input.quarterAdSpend,
      数据覆盖: {
        已填周数: `${input.dataCoverage.filledWeeks}/${input.dataCoverage.totalWeeks}`,
        是否有上月可比: input.dataCoverage.hasPreviousMonth,
      },
      当前手动评级: input.manualRating || null,
      当前备注: input.remark || null,
      负责人: input.decisionOwner || null,
      决策期限: input.decisionDeadline || null,
    },
    null,
    2,
  )}

请结合环比趋势与季度走向给出判断;若数据覆盖不足(如仅填 1-2 周、无上月可比),confidence 设为 low 并在 summary 中说明，rating 可为 null。渠道数据仅含销售额和广告费，无成本口径，评级和建议聚焦投放效率(ROI/广告占销/销售趋势)。
返回结构:${aiJsonSchemaHint}`;
}

export function buildBusinessBlocksAnalysisPrompt(input: BusinessBlockAnalysisPromptInput) {
  return `请分析以下四板块经营数据，并只返回一个 JSON 数组。所有金额单位为人民币本位币(CNY)。数组每一项都必须符合：${aiJsonSchemaHint}，且必须包含 businessBlock 字段。

数据：
${JSON.stringify(
    {
      年份: input.year,
      月份: input.month,
      板块: input.blocks.map((block) => ({ ...block, blockName: block.blockName || businessBlockLabel(block.businessBlock) })),
    },
    null,
    2,
  )}

返回格式示例：
[{"businessBlock":"amazon","rating":"A","ratingReason":"ROI 4.2 高于健康线、毛利率 32%","confidence":"high","summary":"...","riskNotes":[],"actionSuggestion":"...","budgetSuggestion":{"nextBudget":1000,"reason":"..."}}]

如果某个板块数据不足，该板块 rating=null、confidence=low、budgetSuggestion=null。`;
}

export function buildCompanyReviewPrompt(input: CompanyReviewPromptInput) {
  return `你是给公司老板做月度经营汇报的分析师。请基于以下"全公司当月汇总 + 四板块对比"，给出一段公司级总评，只返回符合结构的 JSON。所有金额单位为人民币本位币(CNY)。

数据：
${JSON.stringify(
    {
      年份: input.year,
      月份: input.month,
      全公司汇总: input.totals,
      四板块: input.blocks,
    },
    null,
    2,
  )}

要求:站在老板视角,先判断公司本月整体表现(overallRating + overallSummary,引用总销售额/总毛利/整体ROI等数字),再指出下月第一优先动作(topPriority),并给出跨板块预算挪动建议(capitalShiftSuggestion,例如把表现差的板块预算挪向高ROI板块)。
返回结构:${companyReviewSchemaHint}`;
}
