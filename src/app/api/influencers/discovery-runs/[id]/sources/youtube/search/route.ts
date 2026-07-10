import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageInfluencerDiscovery, forbidden, requireApiSession } from "@/lib/permissions";
import { apiError } from "@/lib/influencer-discovery/candidates";
import { ExternalSourceError, getYoutubeStatus, searchYoutubeCreators } from "@/lib/influencer-discovery/sources";

type Context = { params: Promise<{ id: string }> };

// 用关键词搜索 YouTube 创作者,返回预览(不写库)。搜索消耗 API 配额,需写权限。
export async function POST(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageInfluencerDiscovery(session.role)) return forbidden("当前角色不能使用数据源搜索");
    const { id } = await context.params;
    const runId = Number(id);
    if (!Number.isInteger(runId) || runId <= 0) return NextResponse.json({ message: "无效的任务 ID" }, { status: 400 });

    const run = await prisma.influencerDiscoveryRun.findUnique({ where: { id: runId }, select: { id: true } });
    if (!run) return NextResponse.json({ message: "分析任务不存在" }, { status: 404 });

    const status = getYoutubeStatus();
    if (!status.enabled || !status.configured) {
      return NextResponse.json({ error: "YouTube 数据源未配置", enabled: false }, { status: 503 });
    }

    const body = (await request.json()) as { keyword?: unknown; maxResults?: unknown };
    if (typeof body.keyword !== "string" || !body.keyword.trim()) {
      return NextResponse.json({ error: "请输入搜索关键词", enabled: true }, { status: 400 });
    }
    const maxResults = Number(body.maxResults);

    const items = await searchYoutubeCreators({
      keyword: body.keyword,
      maxResults: Number.isFinite(maxResults) ? maxResults : undefined,
    });

    return NextResponse.json({ items, source: "youtube", keyword: body.keyword.trim().slice(0, 100), enabled: true });
  } catch (error) {
    if (error instanceof ExternalSourceError) {
      return NextResponse.json({ error: error.message, enabled: true }, { status: error.status });
    }
    return apiError(error, "YouTube 搜索失败");
  }
}
