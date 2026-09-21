export type EntryPeriod = { year: number; month: number };
export type EntryWeek = {
  weekNumber: number;
  salesAmountOriginal: number | null;
  adSpendOriginal: number | null;
  salesAmountBase: number | null;
  adSpendBase: number | null;
};
export type EntryRow = {
  channelId: number;
  businessBlock: string;
  businessBlockLabel: string;
  businessLine: string;
  channelName: string;
  owner: string;
  remark: string;
  currency: string;
  exchangeRate: number;
  weeks: EntryWeek[];
  version: string;
  updatedAt: string | null;
  editable: boolean;
};
export type EntryData = EntryPeriod & {
  rows: EntryRow[];
  previousMonth: EntryPeriod;
  previousRows: EntryRow[];
  latestWeek: number;
  updatedAt: string | null;
  asOfDate?: string;
};
export type EntryDraft = {
  owner: string;
  remark: string;
  version: string;
  weeks: Array<Pick<EntryWeek, "weekNumber" | "salesAmountOriginal" | "adSpendOriginal">>;
};
export type EntryChange = { label: string; before: string | number | null; after: string | number | null };
export type EntryAudit = {
  id: number;
  actorName: string;
  createdAt: string;
  channel: { channelName: string; businessLine: string };
  changes: EntryChange[];
};
