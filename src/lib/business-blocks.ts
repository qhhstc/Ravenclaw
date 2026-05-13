export const businessBlockOptions = [
  { label: "亚马逊", value: "amazon" },
  { label: "独立站", value: "independent_site" },
  { label: "TikTok", value: "tiktok" },
  { label: "B端", value: "b2b" },
] as const;

export type BusinessBlock = (typeof businessBlockOptions)[number]["value"];

const blockLabels = Object.fromEntries(businessBlockOptions.map((item) => [item.value, item.label])) as Record<BusinessBlock, string>;

export function businessBlockLabel(value?: string | null) {
  return value && value in blockLabels ? blockLabels[value as BusinessBlock] : "其他";
}

export function normalizeBusinessBlock(value?: string | null): BusinessBlock {
  const text = (value || "").toLowerCase().trim();
  if (["amazon", "亚马逊"].includes(text)) return "amazon";
  if (["tiktok", "tiktok shop", "抖音", "tiktok店铺"].includes(text)) return "tiktok";
  if (["b2b", "b端", "b端业务", "wordpress批发", "wordpress", "批发", "wholesale"].includes(text)) return "b2b";
  if (["independent_site", "独立站", "shopify", "shopify独立站", "dtc", "edm", "seo"].includes(text)) return "independent_site";
  return "independent_site";
}

export function inferBusinessBlock(input: { businessBlock?: string | null; businessLine?: string | null; platformName?: string | null; storeType?: string | null; channelType?: string | null }) {
  if (input.businessBlock) return normalizeBusinessBlock(input.businessBlock);
  return normalizeBusinessBlock(input.businessLine || input.platformName || input.storeType || input.channelType);
}

export function displayRating(input: { aiRating?: string | null; manualRating?: string | null; ratingSource?: string | null }) {
  if (input.ratingSource === "ai" && input.aiRating) return { label: input.aiRating, source: "AI" };
  if (input.ratingSource === "manual" && input.manualRating) return { label: input.manualRating, source: "手动" };
  if (input.aiRating) return { label: input.aiRating, source: "AI" };
  if (input.manualRating) return { label: input.manualRating, source: "手动" };
  return { label: "待分析", source: "none" };
}

export function displayAction(input: { aiActionSuggestion?: string | null; manualActionSuggestion?: string | null }) {
  return input.aiActionSuggestion || input.manualActionSuggestion || "待填写 / 待 AI 分析";
}

export function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}
