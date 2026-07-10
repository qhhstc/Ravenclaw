import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageInfluencerDiscovery, forbidden, requireApiSession } from "@/lib/permissions";
import { influencerInclude } from "@/lib/influencers";
import { apiError } from "@/lib/influencer-discovery/candidates";
import type { RecommendedOffer } from "@/lib/influencer-discovery/types";

type Context = { params: Promise<{ id: string }> };

// recommendedOffer → InfluencerCollaboration.cooperationType(严格按现有 model 的合作类型常量映射)
const OFFER_TO_COOPERATION: Record<RecommendedOffer, string> = {
  paid: "paid_post",
  gifted: "sample",
  affiliate: "affiliate",
  nurture: "other",
  reject: "other",
};

// 转为红人合作记录:严格按 InfluencerCollaboration 真实字段映射,不改旧 model。
// 评分/推荐合作方式/来源 run 等无对应字段的信息写入 remark。
export async function POST(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageInfluencerDiscovery(session.role)) return forbidden("当前角色不能转为合作记录");
    const { id } = await context.params;
    const candidateId = Number(id);
    if (!Number.isInteger(candidateId) || candidateId <= 0) return NextResponse.json({ message: "无效的候选红人 ID" }, { status: 400 });

    const candidate = await prisma.influencerCandidate.findUnique({ where: { id: candidateId }, include: { discoveryRun: { select: { websiteUrl: true } } } });
    if (!candidate) return NextResponse.json({ message: "候选红人不存在" }, { status: 404 });

    const influencerName = candidate.displayName || candidate.handle || candidate.profileUrl || "未命名红人";
    const platform = candidate.platform || "Other";
    const cooperationType = candidate.recommendedOffer ? OFFER_TO_COOPERATION[candidate.recommendedOffer as RecommendedOffer] ?? "sample" : "sample";

    // 把候选侧的评分/推荐/来源信息汇总进 remark(InfluencerCollaboration 无这些字段)
    const remarkParts: string[] = ["【由候选红人转入】"];
    if (typeof candidate.score === "number") remarkParts.push(`评分 ${candidate.score}${candidate.tier ? `（${candidate.tier} 级）` : ""}`);
    if (candidate.recommendedOffer) remarkParts.push(`推荐合作方式：${candidate.recommendedOffer}`);
    if (candidate.discoveryRun?.websiteUrl) remarkParts.push(`来源分析：${candidate.discoveryRun.websiteUrl}`);
    if (candidate.aiReason) remarkParts.push(`AI 理由：${candidate.aiReason}`);
    if (candidate.riskNotes) remarkParts.push(`风险提示：${candidate.riskNotes}`);
    if (candidate.notes) remarkParts.push(`备注：${candidate.notes}`);

    const created = await prisma.$transaction(async (tx) => {
      const collaboration = await tx.influencerCollaboration.create({
        data: {
          influencerName,
          platform,
          accountHandle: candidate.handle,
          profileUrl: candidate.profileUrl,
          countryCode: candidate.country,
          followerCount: candidate.followers ?? 0,
          avgViews: candidate.avgViews ?? 0,
          cooperationType,
          status: "prospecting",
          email: candidate.email,
          ownerId: session.userId,
          remark: remarkParts.join("\n"),
        },
        include: influencerInclude,
      });
      await tx.influencerCandidate.update({ where: { id: candidateId }, data: { status: "collaboration" } });
      return collaboration;
    });

    return NextResponse.json({ item: created });
  } catch (error) {
    return apiError(error, "转为合作记录失败");
  }
}
