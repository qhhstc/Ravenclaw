import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/permissions";
import { apiError } from "@/lib/influencer-discovery/candidates";
import { canonicalDomain } from "@/lib/influencer-discovery/website-analyzer";

// 查同 domain 近 7 天最近一次 completed run,用于列表页复用提示(避免重复消耗 AI/YouTube)
export async function GET(request: NextRequest) {
  try {
    await requireApiSession();
    const raw = request.nextUrl.searchParams.get("domain")?.trim();
    if (!raw) return NextResponse.json({ item: null });
    const domain = canonicalDomain(raw);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const run = await prisma.influencerDiscoveryRun.findFirst({
      where: { websiteDomain: domain, status: "completed", createdAt: { gte: sevenDaysAgo } },
      orderBy: [{ createdAt: "desc" }],
      select: { id: true, websiteUrl: true, websiteDomain: true, brandName: true, createdAt: true, _count: { select: { candidates: true } } },
    });
    if (!run) return NextResponse.json({ item: null });

    return NextResponse.json({
      item: {
        id: run.id,
        websiteUrl: run.websiteUrl,
        websiteDomain: run.websiteDomain,
        brandName: run.brandName,
        candidateCount: run._count.candidates,
        createdAt: run.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return apiError(error, "查询历史分析失败");
  }
}
