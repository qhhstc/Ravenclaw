import { NextResponse } from "next/server";
import { prepareFeishuChannelMonth } from "@/lib/feishu-channel-sync";
import { ApiAuthError, forbidden, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireApiSession();
    if (session.role !== "admin") return forbidden("只有管理员可以生成飞书月度填报行");
    const input = (await request.json().catch(() => ({}))) as { year?: number; month?: number };
    const result = await prepareFeishuChannelMonth(Number(input.year), Number(input.month));
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "生成飞书填报行失败" }, { status: 400 });
  }
}
