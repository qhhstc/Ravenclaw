export type ChannelWeekValue = {
  weekNumber: number;
  salesAmountOriginal: number;
  adSpendOriginal: number;
};

export type ChannelDataRow = {
  channelId: number;
  businessBlock?: string | null;
  businessLine: string;
  channelGroup?: string | null;
  channelName: string;
  channelType: string;
  sortOrder: number;
  status: string;
  brand?: { id: number; name: string; code: string; defaultCurrency?: string } | null;
  platform?: { id: number; name: string; code: string; type?: string } | null;
  store?: {
    id: number;
    name: string;
    domain?: string | null;
    storeType?: string | null;
    marketScope?: string | null;
    primaryMarketCode?: string | null;
    defaultCurrency?: string | null;
    settlementCurrency?: string | null;
  } | null;
  countryCode?: string | null;
  currency: string;
  productCostBase?: number;
  otherCostBase?: number;
  manualRating?: string | null;
  aiRating?: string | null;
  ratingSource?: string | null;
  aiAnalysisStatus?: string | null;
  aiActionSuggestion?: string | null;
  manualActionSuggestion?: string | null;
  aiRiskNotes?: string | null;
  warningType?: string | null;
  warningLevel?: string | null;
  decisionOwner?: string | null;
  decisionDeadline?: string | null;
  nextBudgetBase?: number | null;
  budgetAdjustReason?: string | null;
  aiAnalyzedAt?: string | null;
  quarter?: {
    salesAmount: number;
    adSpend: number;
    productCost: number;
    otherCost: number;
  };
  remark?: string | null;
  weeks: ChannelWeekValue[];
};

export type ChannelDataFilters = {
  year: number;
  month: number;
  brandId?: number;
  platformId?: number;
  storeId?: number;
  businessLine?: string;
  channelType?: string;
};

export type ChannelDataResponse = {
  rows: ChannelDataRow[];
  filters: ChannelDataFilters;
};

export type ChannelSummaryResponse = {
  month: {
    salesAmount: number;
    adSpend: number;
    channelCount: number;
    advertisedChannelCount: number;
  };
  quarter: {
    quarter: number;
    months: number[];
    salesAmount: number;
    adSpend: number;
  };
};

export type BasicOption = {
  label: string;
  value: number | string;
};

export type ChannelDataOptionState = {
  brands: BasicOption[];
  platforms: BasicOption[];
  stores: BasicOption[];
};
