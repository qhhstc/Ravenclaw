import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageInfluencerDiscovery, forbidden, requireApiSession } from "@/lib/permissions";
import { apiError, candidateInclude, serializeCandidate } from "@/lib/influencer-discovery/candidates";
import { buildCandidateCreateInput, RunDedup, type ExternalCandidatePreview } from "@/lib/influencer-discovery/sources";

type Context = { params: Promise<{ id: string }> };

// 勾选导入外部数据源候选红人。人工勾选后才调用,不自动评分。写权限。去重仅限本 run。
export async function POST(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageInfluencerDiscovery(session.role)) return forbidden("当前角色不能导入候选红人");
    const { id } = await context.params;
    const runId = Number(id);
    if (!Number.isInteger(runId) || runId <= 0) return NextResponse.json({ message: "无效的任务 ID" }, { status: 400 });

    const run = await prisma.influencerDiscoveryRun.findUnique({ where: { id: runId }, select: { id: true } });
    if (!run) return NextResponse.json({ message: "分析任务不存在" }, { status: 404 });

    const body = (await request.json()) as { items?: unknown };
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ message: "没有可导入的候选红人" }, { status: 400 });
    }
    const items = body.items as ExternalCandidatePreview[];

    // 该 run 下已有候选,用于去重(内存比对 profileUrl 与 externalId,不跨 run,不依赖 MySQL JSON 查询)
    const existing = await prisma.influencerCandidate.findMany({
      where: { discoveryRunId: runId },
      select: { profileUrl: true, rawDataJson: true },
    });
    const dedup = new RunDedup(existing);

    let skipped = 0;
    const toCreate = [];
    for (const item of items) {
      if (dedup.seen(item)) {
        skipped += 1;
        continue;
      }
      toCreate.push(buildCandidateCreateInput(item, runId));
    }

    if (toCreate.length === 0) {
      return NextResponse.json({ created: 0, skipped, items: [] });
    }

    // createMany 只返回 count;需要回列表则导入后按 run 重新查询
    const result = await prisma.influencerCandidate.createMany({ data: toCreate });
    const refreshed = await prisma.influencerCandidate.findMany({
      where: { discoveryRunId: runId, source: "youtube_api" },
      include: candidateInclude,
      orderBy: [{ id: "desc" }],
      take: toCreate.length,
    });

    return NextResponse.json({ created: result.count, skipped, items: refreshed.map(serializeCandidate) });
  } catch (error) {
    return apiError(error, "导入候选红人失败");
  }
}
