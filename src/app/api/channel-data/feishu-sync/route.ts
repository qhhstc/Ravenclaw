import { NextResponse } from "next/server";
import { syncFeishuChannelData } from "@/lib/feishu-channel-sync";
import { ApiAuthError, forbidden, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await requireApiSession();
    if (session.role !== "admin") return forbidden("只有管理员可以从飞书同步渠道数据");
    return NextResponse.json(await syncFeishuChannelData());
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "飞书渠道数据同步失败" }, { status: 400 });
  }
}
