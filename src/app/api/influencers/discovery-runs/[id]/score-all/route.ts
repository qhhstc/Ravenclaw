import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageInfluencerDiscovery, forbidden, requireApiSession } from "@/lib/permissions";
import { apiError, runToBrandAnalysis } from "@/lib/influencer-discovery/candidates";
import { scoreCandidateById } from "@/lib/influencer-discovery/score-runner";

type Context = { params: Promise<{ id: string }> };

// 批量对该 run 下所有候选红人评分。品牌画像还原一次后复用,串行评分避免并发打满 AI 中转。
export async function POST(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageInfluencerDiscovery(session.role)) return forbidden("当前角色不能执行评分");
    const { id } = await context.params;
    const runId = Number(id);
    if (!Number.isInteger(runId) || runId <= 0) return NextResponse.json({ message: "无效的任务 ID" }, { status: 400 });

    const run = await prisma.influencerDiscoveryRun.findUnique({ where: { id: runId } });
    if (!run) return NextResponse.json({ message: "分析任务不存在" }, { status: 404 });

    const brand = runToBrandAnalysis(run);
    const candidates = await prisma.influencerCandidate.findMany({ where: { discoveryRunId: runId }, select: { id: true } });

    let scored = 0;
    let failed = 0;
    for (const c of candidates) {
      try {
        await scoreCandidateById(c.id, brand);
        scored += 1;
      } catch {
        failed += 1;
      }
    }
    return NextResponse.json({ ok: true, scored, failed, total: candidates.length });
  } catch (error) {
    return apiError(error, "批量评分失败");
  }
}
