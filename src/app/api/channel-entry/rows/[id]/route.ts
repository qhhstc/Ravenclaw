import { NextResponse, type NextRequest } from "next/server";
import { updatePublicChannelEntry } from "@/lib/public-channel-entry";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = (await request.json()) as { year?: number; month?: number; actorName?: string; weeks?: Array<{ weekNumber: number; salesAmountOriginal: number; adSpendOriginal: number }>; };
    const row = await updatePublicChannelEntry({
      year: Number(input.year),
      month: Number(input.month),
      channelId: Number(id),
      actorName: input.actorName || "",
      weeks: Array.isArray(input.weeks) ? input.weeks : [],
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ row });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "渠道数据保存失败" }, { status: 400 });
  }
}
