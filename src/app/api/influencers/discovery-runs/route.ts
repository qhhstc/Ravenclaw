import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageInfluencerDiscovery, forbidden, requireApiSession } from "@/lib/permissions";
import { apiError, runInclude, serializeRun } from "@/lib/influencer-discovery/candidates";
import { parsePositiveInt } from "@/lib/influencers";
import { canonicalDomain, normalizeWebsiteUrl, WebsiteFetchError } from "@/lib/influencer-discovery/website-analyzer";

export async function GET(request: NextRequest) {
  try {
    await requireApiSession();
    const params = request.nextUrl.searchParams;
    const page = parsePositiveInt(params.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(params.get("pageSize"), 10), 100);
    const status = params.get("status");
    const where = status ? { status } : {};
    const [rawItems, total] = await Promise.all([
      prisma.influencerDiscoveryRun.findMany({
        where,
        include: runInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.influencerDiscoveryRun.count({ where }),
    ]);
    return NextResponse.json({ items: rawItems.map(serializeRun), total, page, pageSize });
  } catch (error) {
    return apiError(error, "分析任务列表加载失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canManageInfluencerDiscovery(session.role)) return forbidden("当前角色不能创建分析任务");
    const input = (await request.json()) as { websiteUrl?: unknown };
    if (typeof input.websiteUrl !== "string") throw new WebsiteFetchError("请输入网站地址");
    const websiteUrl = normalizeWebsiteUrl(input.websiteUrl);
    const domain = canonicalDomain(new URL(websiteUrl).hostname);
    const run = await prisma.influencerDiscoveryRun.create({
      data: {
        websiteUrl,
        websiteDomain: domain,
        status: "pending",
        source: "website",
        createdById: session.userId,
      },
      include: runInclude,
    });
    return NextResponse.json({ item: serializeRun(run) });
  } catch (error) {
    return apiError(error, "分析任务创建失败");
  }
}
