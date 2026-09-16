import { NextResponse, type NextRequest } from "next/server";
import { EntryError, entryPeriodFromQuery, getPublicEntryData, preparePublicChannelMonth, validateEntryPeriod } from "@/lib/public-channel-entry";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { year, month } = entryPeriodFromQuery(request.nextUrl.searchParams);
    return NextResponse.json(await getPublicEntryData(year, month), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof EntryError ? error.message : "渠道数据加载失败，请稍后重试" }, { status: error instanceof EntryError ? error.status : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json().catch(() => ({}))) as { year?: number; month?: number };
    const { year, month } = validateEntryPeriod(input.year, input.month);
    return NextResponse.json(await preparePublicChannelMonth(year, month));
  } catch (error) {
    return NextResponse.json({ message: error instanceof EntryError ? error.message : "准备本月填报失败，请稍后重试" }, { status: error instanceof EntryError ? error.status : 500 });
  }
}
