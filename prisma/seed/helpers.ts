import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

export const databaseUrl = process.env.DATABASE_URL || "mysql://root:password@localhost:3306/cross_border_data_center";

export function createSeedClient() {
  const adapter = new PrismaMariaDb(databaseUrl);
  return new PrismaClient({ adapter });
}

export function codeFromName(name: string) {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function quarterFromMonth(month: number) {
  return Math.ceil(month / 3);
}

export const platformTypes: Record<string, string> = {
  Amazon: "marketplace",
  Shopify: "independent_site",
  WordPress: "wholesale_site",
  TikTok: "social",
  "Meta Ads": "ads",
  "Google Ads": "ads",
  SEO: "organic",
  EDM: "email",
  Influencer: "influencer",
  Manual: "manual",
};

export const currencySeeds = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
];

export const countrySeeds = [
  { code: "US", name: "United States", region: "North America" },
  { code: "CN", name: "China", region: "Asia" },
  { code: "JP", name: "Japan", region: "Asia" },
  { code: "UK", name: "United Kingdom", region: "Europe" },
  { code: "CA", name: "Canada", region: "North America" },
  { code: "AU", name: "Australia", region: "Oceania" },
  { code: "FR", name: "France", region: "Europe" },
  { code: "DE", name: "Germany", region: "Europe" },
  { code: "NL", name: "Netherlands", region: "Europe" },
  { code: "KR", name: "South Korea", region: "Asia" },
  { code: "AE", name: "United Arab Emirates", region: "Middle East" },
  { code: "SG", name: "Singapore", region: "Asia" },
];

export const exchangeRateSeeds = [
  { baseCurrency: "USD", targetCurrency: "CNY", rate: 7.1 },
  { baseCurrency: "JPY", targetCurrency: "CNY", rate: 0.047 },
  { baseCurrency: "EUR", targetCurrency: "CNY", rate: 7.7 },
  { baseCurrency: "GBP", targetCurrency: "CNY", rate: 8.95 },
];
