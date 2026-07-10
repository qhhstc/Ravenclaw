import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/permissions";
import { apiError, candidateInclude, runInclude, serializeCandidate, serializeRun } from "@/lib/influencer-discovery/candidates";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requireApiSession();
    const { id } = await context.params;
    const runId = Number(id);
    if (!Number.isInteger(runId) || runId <= 0) return NextResponse.json({ message: "无效的任务 ID" }, { status: 400 });
    const run = await prisma.influencerDiscoveryRun.findUnique({ where: { id: runId }, include: runInclude });
    if (!run) return NextResponse.json({ message: "分析任务不存在" }, { status: 404 });
    const candidates = await prisma.influencerCandidate.findMany({
      where: { discoveryRunId: runId },
      include: candidateInclude,
      orderBy: [{ score: "desc" }, { id: "desc" }],
    });
    return NextResponse.json({ item: serializeRun(run), candidates: candidates.map(serializeCandidate) });
  } catch (error) {
    return apiError(error, "分析任务详情加载失败");
  }
}
