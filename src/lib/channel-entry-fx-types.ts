export type EntryFxQuote = {
  currency: string;
  targetCurrency: "CNY";
  rate: number | null;
  rateDate: string | null;
  checkedAt: string;
  source: "ecb" | "same_currency";
  stale: boolean;
  error: string | null;
};
