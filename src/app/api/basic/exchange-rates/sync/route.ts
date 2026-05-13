import { NextResponse, type NextRequest } from "next/server";
import { getLatestExchangeRate, upsertExchangeRate } from "@/lib/exchange-rates";
import { prisma } from "@/lib/prisma";
import { canManageProducts, forbidden, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

type SyncResult = {
  from: string;
  to: string;
  ok: boolean;
  rate?: number;
  source?: string;
  message?: string;
};

function uniquePairs(values: Array<{ baseCurrency: string; targetCurrency: string }>) {
  const map = new Map<string, { from: string; to: string }>();
  values.forEach((item) => {
    const from = item.baseCurrency.toUpperCase();
    const to = item.targetCurrency.toUpperCase();
    if (from && to && from !== to) map.set(`${from}-${to}`, { from, to });
  });
  return Array.from(map.values());
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canManageProducts(session.role)) return forbidden("当前角色不能更新汇率");

    const body = (await request.json().catch(() => ({}))) as { pairs?: Array<{ from?: string; to?: string }>; targetCurrency?: string };
    const targetCurrency = (body.targetCurrency || "CNY").toUpperCase();
    const requestedPairs = body.pairs
      ?.map((item) => ({ baseCurrency: item.from || "", targetCurrency: item.to || targetCurrency }))
      .filter((item) => item.baseCurrency && item.targetCurrency);

    const sourcePairs = requestedPairs?.length
      ? requestedPairs
      : await prisma.exchangeRate.findMany({
          distinct: ["baseCurrency", "targetCurrency"],
          select: { baseCurrency: true, targetCurrency: true },
        });
    const pairs = uniquePairs(sourcePairs.length ? sourcePairs : ["USD", "EUR", "JPY", "GBP"].map((currency) => ({ baseCurrency: currency, targetCurrency })));
    const rateDate = new Date();

    const results: SyncResult[] = [];
    for (const pair of pairs) {
      const latestRate = await getLatestExchangeRate(pair.from, pair.to);
      if (!latestRate || latestRate.source === "local") {
        results.push({ from: pair.from, to: pair.to, ok: false, message: "未获取到外部最新汇率" });
        continue;
      }

      await upsertExchangeRate(pair.from, pair.to, latestRate.rate, rateDate);
      results.push({ from: pair.from, to: pair.to, ok: true, rate: latestRate.rate, source: latestRate.source });
    }

    return NextResponse.json({
      updated: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "汇率更新失败";
    return NextResponse.json({ message }, { status: 400 });
  }
}
