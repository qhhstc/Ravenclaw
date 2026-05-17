import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { apiError, buildInfluencerWhere, influencerInclude, normalizeInfluencerInput, parsePositiveInt } from "@/lib/influencers";
import { prisma } from "@/lib/prisma";
import { canManageInfluencers, forbidden, requireApiSession } from "@/lib/permissions";

const activeStatuses = ["prospecting", "contacted", "sample_sent", "content_pending", "published"];
const excludedOrderStatuses = ["cancelled", "refunded"];

function numberValue(value: unknown) {
  return Number(value ?? 0);
}

async function orderRollups(ids: number[]) {
  if (!ids.length) return new Map<number, { orderCount: number; salesAmount: number; grossProfit: number }>();
  const rows = await prisma.order.groupBy({
    by: ["influencerCollaborationId"],
    where: {
      influencerCollaborationId: { in: ids },
      orderStatus: { notIn: excludedOrderStatuses },
    },
    _count: { id: true },
    _sum: { salesAmount: true, grossProfit: true },
  });
  return new Map(
    rows
      .filter((row) => row.influencerCollaborationId)
      .map((row) => [
        row.influencerCollaborationId!,
        {
          orderCount: row._count.id,
          salesAmount: numberValue(row._sum.salesAmount),
          grossProfit: numberValue(row._sum.grossProfit),
        },
      ]),
  );
}

function withOrderMetrics<T extends { id: number; totalCostBase: unknown; salesAmount: unknown; exchangeRate: unknown; orderCount: unknown; roi: unknown }>(
  item: T,
  rollup?: { orderCount: number; salesAmount: number; grossProfit: number },
) {
  const linkedOrderCount = rollup?.orderCount ?? 0;
  const linkedSalesAmountBase = rollup?.salesAmount ?? 0;
  const linkedGrossProfit = rollup?.grossProfit ?? 0;
  const manualSalesAmountBase = numberValue(item.salesAmount) * numberValue(item.exchangeRate || 1);
  const totalCostBase = numberValue(item.totalCostBase);
  const effectiveSalesAmountBase = linkedOrderCount > 0 ? linkedSalesAmountBase : manualSalesAmountBase;
  const effectiveOrderCount = linkedOrderCount > 0 ? linkedOrderCount : numberValue(item.orderCount);
  const effectiveRoi = totalCostBase > 0 ? effectiveSalesAmountBase / totalCostBase : null;
  return {
    ...item,
    linkedOrderCount,
    linkedSalesAmountBase: Number(linkedSalesAmountBase.toFixed(2)),
    linkedGrossProfit: Number(linkedGrossProfit.toFixed(2)),
    linkedRoi: totalCostBase > 0 && linkedOrderCount > 0 ? Number((linkedSalesAmountBase / totalCostBase).toFixed(6)) : null,
    effectiveSalesAmountBase: Number(effectiveSalesAmountBase.toFixed(2)),
    effectiveOrderCount,
    effectiveRoi: effectiveRoi === null ? null : Number(effectiveRoi.toFixed(6)),
    metricSource: linkedOrderCount > 0 ? "orders" : "manual",
  };
}

async function buildSummary(where: Prisma.InfluencerCollaborationWhereInput) {
  const [total, active, published, nextFollowups, rows] = await Promise.all([
    prisma.influencerCollaboration.count({ where }),
    prisma.influencerCollaboration.count({ where: { AND: [where, { status: { in: activeStatuses } }] } }),
    prisma.influencerCollaboration.count({ where: { AND: [where, { status: "published" }] } }),
    prisma.influencerCollaboration.count({ where: { AND: [where, { nextFollowupAt: { not: null }, status: { notIn: ["settled", "cancelled"] } }] } }),
    prisma.influencerCollaboration.findMany({
      where,
      select: { id: true, totalCostBase: true, salesAmount: true, exchangeRate: true, orderCount: true, roi: true },
    }),
  ]);
  const rollups = await orderRollups(rows.map((row) => row.id));
  const enriched = rows.map((row) => withOrderMetrics(row, rollups.get(row.id)));
  const totalCostBase = enriched.reduce((sum, row) => sum + numberValue(row.totalCostBase), 0);
  const salesAmountBase = enriched.reduce((sum, row) => sum + numberValue(row.effectiveSalesAmountBase), 0);
  const orderCount = enriched.reduce((sum, row) => sum + numberValue(row.effectiveOrderCount), 0);
  const roiRows = enriched.map((row) => row.effectiveRoi).filter((value) => value !== null);

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
    const pageSize = Math.min(parsePositiveInt(params.get("pageSize"), 10), 100);
    const where = buildInfluencerWhere(params);
    const [rawItems, total, summary] = await Promise.all([
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
    const rollups = await orderRollups(rawItems.map((item) => item.id));
    const items = rawItems.map((item) => withOrderMetrics(item, rollups.get(item.id)));
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
