import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { EntryError, updatePublicChannelEntry } from "@/lib/public-channel-entry";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = (await request.json()) as Record<string, unknown>;
    const row = await updatePublicChannelEntry({
      year: Number(input.year),
      month: Number(input.month),
      channelId: Number(id),
      actorName: input.actorName,
      owner: input.owner,
      remark: input.remark,
      version: input.version,
      weeks: input.weeks,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ row });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ message: "这行正在被其他人修改，请刷新核对后重试" }, { status: 409 });
    return NextResponse.json({ message: error instanceof EntryError ? error.message : error instanceof SyntaxError ? "请求格式不正确" : "渠道数据保存失败，请稍后重试" }, { status: error instanceof EntryError ? error.status : error instanceof SyntaxError ? 400 : 500 });
  }
}
