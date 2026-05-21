import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type FrankfurterResponse = {
  rates?: Record<string, number>;
};

type ExchangeRateLookupOptions = {
  asOfDate?: Date | null;
  preferLocal?: boolean;
};

export type LatestExchangeRateResult = {
  from: string;
  to: string;
  rate: number;
  source: "same_currency" | "frankfurter" | "local";
};

async function fetchExternalExchangeRate(from: string, to: string): Promise<LatestExchangeRateResult | null> {
  try {
    const response = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
    const data = (await response.json()) as FrankfurterResponse;
    const rate = data.rates?.[to];
    if (response.ok && rate && Number.isFinite(rate)) {
      return { from, to, rate, source: "frankfurter" };
    }
  } catch {
    // Fall through to local rate table.
  }
  return null;
}

async function findLocalExchangeRate(from: string, to: string, asOfDate?: Date | null): Promise<LatestExchangeRateResult | null> {
  const localRate = await prisma.exchangeRate.findFirst({
    where: {
      baseCurrency: from,
      targetCurrency: to,
      ...(asOfDate ? { rateDate: { lte: asOfDate } } : {}),
    },
    orderBy: { rateDate: "desc" },
  });
  if (!localRate) return null;
  return { from, to, rate: Number(localRate.rate), source: "local" };
}

export async function getLatestExchangeRate(fromCurrency: string, toCurrency: string, options: ExchangeRateLookupOptions = {}): Promise<LatestExchangeRateResult | null> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return { from, to, rate: 1, source: "same_currency" };

  if (options.preferLocal !== false) {
    const localRate = await findLocalExchangeRate(from, to, options.asOfDate);
    if (localRate) return localRate;
  }

  const externalRate = await fetchExternalExchangeRate(from, to);
  if (externalRate) return externalRate;

  return findLocalExchangeRate(from, to, options.asOfDate);
}

export async function upsertExchangeRate(fromCurrency: string, toCurrency: string, rate: number, rateDate = new Date()) {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  const normalizedDate = new Date(Date.UTC(rateDate.getUTCFullYear(), rateDate.getUTCMonth(), rateDate.getUTCDate()));

  return prisma.exchangeRate.upsert({
    where: {
      baseCurrency_targetCurrency_rateDate: {
        baseCurrency: from,
        targetCurrency: to,
        rateDate: normalizedDate,
      },
    },
    update: { rate: new Prisma.Decimal(rate) },
    create: {
      baseCurrency: from,
      targetCurrency: to,
      rate: new Prisma.Decimal(rate),
      rateDate: normalizedDate,
    },
  });
}
