import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, toNumber } from "@/lib/orders";
import { requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

type FrankfurterResponse = {
  rates?: Record<string, number>;
  message?: string;
};

export async function GET(request: NextRequest) {
  try {
    await requireApiSession();
    const from = (request.nextUrl.searchParams.get("from") || "USD").toUpperCase();
    const to = (request.nextUrl.searchParams.get("to") || "CNY").toUpperCase();
    if (from === to) return NextResponse.json({ from, to, rate: 1, source: "same_currency" });

    try {
      const response = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
      const data = (await response.json()) as FrankfurterResponse;
      const rate = data.rates?.[to];
      if (response.ok && rate && Number.isFinite(rate)) {
        return NextResponse.json({ from, to, rate, source: "frankfurter" });
      }
    } catch {
      // Fall through to local rate table.
    }

    const localRate = await prisma.exchangeRate.findFirst({
      where: { baseCurrency: from, targetCurrency: to },
      orderBy: { rateDate: "desc" },
    });
    if (localRate) return NextResponse.json({ from, to, rate: toNumber(localRate.rate, 1), source: "local" });
    return NextResponse.json({ message: "暂未获取到参考汇率，请手动填写" }, { status: 404 });
  } catch (error) {
    return apiError(error, "参考汇率获取失败");
  }
}
