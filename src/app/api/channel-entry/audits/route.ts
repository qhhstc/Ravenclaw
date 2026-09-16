import { NextResponse, type NextRequest } from "next/server";
import { EntryError, entryPeriodFromQuery, getPublicChannelAudits } from "@/lib/public-channel-entry";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { year, month } = entryPeriodFromQuery(request.nextUrl.searchParams);
    return NextResponse.json({ audits: await getPublicChannelAudits(year, month) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof EntryError ? error.message : "修改记录加载失败，请稍后重试" }, { status: error instanceof EntryError ? error.status : 500 });
  }
}
