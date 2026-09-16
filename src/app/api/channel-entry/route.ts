import { NextResponse, type NextRequest } from "next/server";
import { getPublicChannelRows, preparePublicChannelMonth } from "@/lib/public-channel-entry";

export const runtime = "nodejs";

function parsePeriod(request: NextRequest) {
  const now = new Date();
  const yearValue = Number(request.nextUrl.searchParams.get("year"));
  const monthValue = Number(request.nextUrl.searchParams.get("month"));
  const year = Number.isInteger(yearValue) && yearValue >= 2000 && yearValue <= 2100 ? yearValue : now.getFullYear();
  const month = Number.isInteger(monthValue) && monthValue >= 1 && monthValue <= 12 ? monthValue : now.getMonth() + 1;
  return { year, month };
}

export async function GET(request: NextRequest) {
  try {
    const { year, month } = parsePeriod(request);
    await preparePublicChannelMonth(year, month);
    return NextResponse.json({ year, month, rows: await getPublicChannelRows(year, month) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "公共渠道数据加载失败" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json().catch(() => ({}))) as { year?: number; month?: number };
    const year = Number(input.year);
    const month = Number(input.month);
    return NextResponse.json(await preparePublicChannelMonth(year, month));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "生成本月填报失败" }, { status: 400 });
  }
}
