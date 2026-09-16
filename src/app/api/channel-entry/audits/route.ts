import { NextResponse, type NextRequest } from "next/server";
import { getPublicChannelAudits } from "@/lib/public-channel-entry";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const year = Number(request.nextUrl.searchParams.get("year"));
  const month = Number(request.nextUrl.searchParams.get("month"));
  if (!Number.isInteger(year) || !Number.isInteger(month)) return NextResponse.json({ message: "年月不正确" }, { status: 400 });
  return NextResponse.json({ audits: await getPublicChannelAudits(year, month) });
}
