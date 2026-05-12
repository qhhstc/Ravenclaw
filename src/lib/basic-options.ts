export const statusOptions = [
  { label: "启用", value: "active" },
  { label: "停用", value: "inactive" },
];

export const platformTypeOptions = [
  { label: "平台电商", value: "marketplace" },
  { label: "独立站", value: "independent_site" },
  { label: "批发站", value: "wholesale_site" },
  { label: "广告平台", value: "ads" },
  { label: "自然流量", value: "organic" },
  { label: "社媒平台", value: "social" },
  { label: "红人/达人", value: "influencer" },
  { label: "邮件", value: "email" },
  { label: "手动", value: "manual" },
];

export const storeTypeOptions = [
  { label: "Amazon Store", value: "amazon_store" },
  { label: "Shopify / DTC Site", value: "shopify_dtc_site" },
  { label: "WordPress / Wholesale Site", value: "wordpress_wholesale_site" },
  { label: "TikTok Shop", value: "tiktok_shop" },
  { label: "手动店铺/站点", value: "manual_store" },
  { label: "Ads Account", value: "ads_account" },
  { label: "Content Channel", value: "content_channel" },
  { label: "Other", value: "other" },
];

export const marketScopeOptions = [
  { label: "单一市场", value: "single_market" },
  { label: "多市场", value: "multi_market" },
  { label: "全球", value: "global" },
];

export const channelTypeOptions = [
  { label: "店铺整体", value: "store" },
  { label: "付费流量", value: "paid" },
  { label: "付费广告", value: "paid_ads" },
  { label: "自然流量", value: "organic" },
  { label: "推荐流量", value: "referral" },
  { label: "红人/达人", value: "influencer" },
  { label: "平台自然", value: "marketplace" },
  { label: "邮件", value: "email" },
  { label: "手动", value: "manual" },
  { label: "其他", value: "other" },
];

export const businessLineOptions = [
  { label: "默认业务线", value: "默认业务线" },
  { label: "Amazon", value: "Amazon" },
  { label: "Shopify独立站", value: "Shopify独立站" },
  { label: "WordPress批发", value: "WordPress批发" },
  { label: "TikTok", value: "TikTok" },
  { label: "红人/达人", value: "红人/达人" },
  { label: "SEO", value: "SEO" },
  { label: "EDM", value: "EDM" },
  { label: "其他", value: "其他" },
];

export function optionLabel(options: Array<{ label: string; value: string }>, value?: string | null) {
  return options.find((option) => option.value === value)?.label ?? value ?? "-";
}
