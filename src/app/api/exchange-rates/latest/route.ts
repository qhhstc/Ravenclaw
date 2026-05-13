import { NextResponse, type NextRequest } from "next/server";
import { getLatestExchangeRate } from "@/lib/exchange-rates";
import { apiError } from "@/lib/orders";
import { requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireApiSession();
    const from = (request.nextUrl.searchParams.get("from") || "USD").toUpperCase();
    const to = (request.nextUrl.searchParams.get("to") || "CNY").toUpperCase();
    const latestRate = await getLatestExchangeRate(from, to);
    if (latestRate) return NextResponse.json(latestRate);
    return NextResponse.json({ message: "暂未获取到参考汇率，请手动填写" }, { status: 404 });
  } catch (error) {
    return apiError(error, "参考汇率获取失败");
  }
}
