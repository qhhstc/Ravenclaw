import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageInfluencerDiscovery, forbidden, requireApiSession } from "@/lib/permissions";
import { apiError, candidateInclude, serializeCandidate } from "@/lib/influencer-discovery/candidates";
import { scoreCandidateById } from "@/lib/influencer-discovery/score-runner";

type Context = { params: Promise<{ id: string }> };

// 单个候选红人重新评分:取其绑定 run 的品牌画像作输入,后端确定性评分。
export async function POST(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageInfluencerDiscovery(session.role)) return forbidden("当前角色不能执行评分");
    const { id } = await context.params;
    const candidateId = Number(id);
    if (!Number.isInteger(candidateId) || candidateId <= 0) return NextResponse.json({ message: "无效的候选红人 ID" }, { status: 400 });

    await scoreCandidateById(candidateId);
    const item = await prisma.influencerCandidate.findUnique({ where: { id: candidateId }, include: candidateInclude });
    return NextResponse.json({ item: item ? serializeCandidate(item) : null });
  } catch (error) {
    return apiError(error, "评分失败");
  }
}
