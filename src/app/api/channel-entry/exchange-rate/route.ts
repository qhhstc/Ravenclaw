import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { currentEntryPeriod, EntryError } from "@/lib/public-channel-entry";
import { applyPublicEntryExchangeRate } from "@/lib/channel-entry-fx";
import { getEntryFxQuote } from "@/lib/channel-entry-fx-quotes";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const currency = (request.nextUrl.searchParams.get("currency") || "USD").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ message: "币种格式不正确" }, { status: 400 });
  const quote = await getEntryFxQuote(currency, { force: request.nextUrl.searchParams.get("refresh") === "1" });
  return NextResponse.json({ quote, currentPeriod: currentEntryPeriod() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json();
    return NextResponse.json(await applyPublicEntryExchangeRate({ ...input, ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip"), userAgent: request.headers.get("user-agent") }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ message: "渠道数据正在更新，本次汇率未应用，请刷新核对" }, { status: 409 });
    return NextResponse.json({ message: error instanceof EntryError ? error.message : error instanceof SyntaxError ? "请求格式不正确" : "未能确认汇率更新结果，请刷新核对后再重试" }, { status: error instanceof EntryError ? error.status : error instanceof SyntaxError ? 400 : 500 });
  }
}
