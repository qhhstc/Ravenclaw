import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { apiError, buildInfluencerWhere, influencerInclude, normalizeInfluencerInput, parsePositiveInt } from "@/lib/influencers";
import { prisma } from "@/lib/prisma";
import { canManageInfluencers, forbidden, requireApiSession } from "@/lib/permissions";

const activeStatuses = ["prospecting", "contacted", "sample_sent", "content_pending", "published"];

function numberValue(value: unknown) {
  return Number(value ?? 0);
}

async function buildSummary(where: Prisma.InfluencerCollaborationWhereInput) {
  const [total, active, published, nextFollowups, rows] = await Promise.all([
    prisma.influencerCollaboration.count({ where }),
    prisma.influencerCollaboration.count({ where: { AND: [where, { status: { in: activeStatuses } }] } }),
    prisma.influencerCollaboration.count({ where: { AND: [where, { status: "published" }] } }),
    prisma.influencerCollaboration.count({ where: { AND: [where, { nextFollowupAt: { not: null }, status: { notIn: ["settled", "cancelled"] } }] } }),
    prisma.influencerCollaboration.findMany({
      where,
      select: { totalCostBase: true, salesAmount: true, exchangeRate: true, orderCount: true, roi: true },
    }),
  ]);
  const totalCostBase = rows.reduce((sum, row) => sum + numberValue(row.totalCostBase), 0);
  const salesAmountBase = rows.reduce((sum, row) => sum + numberValue(row.salesAmount) * numberValue(row.exchangeRate || 1), 0);
  const orderCount = rows.reduce((sum, row) => sum + numberValue(row.orderCount), 0);
  const roiRows = rows.map((row) => row.roi).filter((value) => value !== null);

  return {
    total,
    active,
    published,
    nextFollowups,
    totalCostBase: Number(totalCostBase.toFixed(2)),
    salesAmount: Number(salesAmountBase.toFixed(2)),
    orderCount,
    avgRoi: roiRows.length ? Number((roiRows.reduce((sum, value) => sum + numberValue(value), 0) / roiRows.length).toFixed(6)) : null,
    baseCurrency: "CNY",
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireApiSession();
    const params = request.nextUrl.searchParams;
    const page = parsePositiveInt(params.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(params.get("pageSize"), 10), 50);
    const where = buildInfluencerWhere(params);
    const [items, total, summary] = await Promise.all([
      prisma.influencerCollaboration.findMany({
        where,
        include: influencerInclude,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.influencerCollaboration.count({ where }),
      buildSummary(where),
    ]);
    return NextResponse.json({ items, total, page, pageSize, summary });
  } catch (error) {
    return apiError(error, "红人合作列表加载失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canManageInfluencers(session.role)) return forbidden("当前角色不能维护红人合作");
    const input = (await request.json()) as Record<string, unknown>;
    const item = await prisma.influencerCollaboration.create({ data: normalizeInfluencerInput(input), include: influencerInclude });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "红人合作创建失败");
  }
}
