import { businessBlockLabel } from "@/lib/business-blocks";

export type AiAnalysisResult = {
  rating: "S" | "A" | "B" | "C" | null;
  summary: string;
  riskNotes: string[];
  actionSuggestion: string;
  budgetSuggestion: { nextBudget: number; reason: string } | null;
};

export type ChannelAnalysisPromptInput = {
  year: number;
  month: number;
  businessBlock?: string | null;
  channelName: string;
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

export const aiJsonSchemaHint = `{
  "rating": "S" | "A" | "B" | "C" | null,
  "summary": "一句话总结",
  "riskNotes": ["风险1", "风险2"],
  "actionSuggestion": "建议动作",
  "budgetSuggestion": { "nextBudget": 0, "reason": "预算调整原因" } | null
}`;

export const aiSystemPrompt = `你是一个跨境电商经营分析助手，帮助管理者分析渠道效率、经营毛利、ROI、广告占销和预算动作。
只能输出严格 JSON，不要输出 Markdown，不要输出解释性废话。
不要编造没有的数据。数据不足时要明确说明数据不足。
不要因为广告为 0 就直接判差，需要结合自然流量、SEO、EDM、老客户等渠道特征。
评级标准仅作参考，不要绝对化：S=ROI高、毛利率高、增长好；A=表现健康，可继续投入；B=表现一般，需要观察或优化；C=风险较高，需要收缩、排查或暂停。
风险提示不超过 3 条。建议动作要具体、可执行。预算建议要保守，不要夸张。
输出字段必须完全符合：${aiJsonSchemaHint}`;

export function buildChannelAnalysisPrompt(input: ChannelAnalysisPromptInput) {
  return `请分析以下渠道效率数据，并只返回 JSON。

数据：
${JSON.stringify(
    {
      年份: input.year,
      月份: input.month,
      板块: businessBlockLabel(input.businessBlock),
      渠道名称: input.channelName,
      W1_W5: input.weeks,
      月销售额: input.monthSales,
      月广告费: input.monthAdSpend,
      ROI: input.roi,
      广告占销: input.adSpendRatio,
      销售占比: input.salesShare,
      产品成本: input.productCost,
      其他成本: input.otherCost,
      经营毛利: input.grossProfit,
      毛利率: input.grossMargin,
      环比上月: input.monthOverMonth,
      当前手动评级: input.manualRating || null,
      当前备注: input.remark || null,
      负责人: input.decisionOwner || null,
      deadline: input.decisionDeadline || null,
    },
    null,
    2,
  )}

如果销售、广告、成本数据明显不足，请返回 rating=null，并建议先补充 W1-W5 销售、广告、产品成本和其他成本。`;
}

export function buildBusinessBlocksAnalysisPrompt(input: BusinessBlockAnalysisPromptInput) {
  return `请分析以下四板块经营数据，并只返回一个 JSON 数组。数组每一项都必须符合：${aiJsonSchemaHint}，且必须包含 businessBlock 字段。

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
[{"businessBlock":"amazon","rating":"A","summary":"...","riskNotes":[],"actionSuggestion":"...","budgetSuggestion":{"nextBudget":1000,"reason":"..."}}]

如果某个板块数据不足，该板块 rating=null，budgetSuggestion=null。`;
}
