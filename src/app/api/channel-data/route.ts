import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { logApiDuration } from "@/lib/api-logger";
import {
  PERIOD_TYPE_WEEK,
  WEEK_NUMBERS,
  getMonthlyRows,
  normalizeMoney,
  parseChannelDataFilters,
  quarterFromMonth,
  toDecimal,
  toNumber,
  type ChannelDataRowInput,
} from "@/lib/channel-data";
import { inferBusinessBlock } from "@/lib/business-blocks";
import { ApiAuthError, forbidden, requireApiSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function apiError(error: unknown) {
  if (error instanceof ApiAuthError) return NextResponse.json({ message: error.message }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return NextResponse.json({ message: "数据已存在，请刷新后重试" }, { status: 409 });
    if (error.code === "P2003") return NextResponse.json({ message: "关联基础资料不存在，请检查渠道配置" }, { status: 409 });
  }
  return NextResponse.json(
    { message: error instanceof Error ? error.message : "渠道数据操作失败" },
    { status: 400 },
  );
}

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  try {
    const session = await requireApiSession();
    if (!["admin", "finance"].includes(session.role)) return forbidden("当前角色不能查看全局渠道经营数据");
    const filters = parseChannelDataFilters(request.nextUrl.searchParams);
    const rows = await getMonthlyRows(filters);
    return NextResponse.json({ rows, filters });
  } catch (error) {
    return apiError(error);
  } finally {
    logApiDuration("/api/channel-data", startedAt);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (session.role !== "admin") return forbidden("当前角色不能维护渠道经营数据");
    const input = (await request.json()) as {
      year?: number;
      month?: number;
      rows?: ChannelDataRowInput[];
    };
    const year = Number(input.year);
    const month = Number(input.month);
    const rows = Array.isArray(input.rows) ? input.rows : [];

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new Error("年份不正确");
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error("月份不正确");
    }

    const quarter = quarterFromMonth(month);
    const channelIds = rows.map((row) => row.channelId).filter((channelId) => Number.isInteger(channelId));
    const channels = await prisma.channel.findMany({
      where: { id: { in: channelIds } },
      include: {
        brand: { select: { id: true, defaultCurrency: true } },
        platform: { select: { id: true, name: true } },
        store: { select: { id: true, primaryMarketCode: true, defaultCurrency: true, storeType: true } },
      },
    });
    const channelMap = new Map(channels.map((channel) => [channel.id, channel]));

    await prisma.$transaction(
      rows.flatMap((row) => {
        const channel = channelMap.get(row.channelId);
        if (!channel?.brandId || !channel.platformId) return [];

        const brandId = channel.brandId;
        const platformId = channel.platformId;
        const currency = row.currency || channel.store?.defaultCurrency || channel.brand?.defaultCurrency || "CNY";
        const exchangeRate = Math.max(toNumber(row.exchangeRate, 1), 0) || 1;
        const countryCode = row.countryCode || channel.store?.primaryMarketCode || null;
        const businessBlock = inferBusinessBlock({
          businessBlock: row.businessBlock,
          businessLine: channel.businessLine,
          platformName: channel.platform?.name,
          storeType: channel.store?.storeType,
          channelType: channel.channelType,
        });
        const productCostBase = normalizeMoney(row.productCostBase);
        const otherCostBase = normalizeMoney(row.otherCostBase);
        const manualRating = row.manualRating?.trim() || null;
        const ratingSource = row.ratingSource === "ai" || row.ratingSource === "manual" ? row.ratingSource : manualRating ? "manual" : "none";
        const aiAnalysisStatus = row.aiAnalysisStatus?.trim() || "pending";
        const manualActionSuggestion = row.manualActionSuggestion?.trim() || null;
        const warningType = row.warningType?.trim() || null;
        const warningLevel = row.warningLevel?.trim() || null;
        const decisionOwner = row.decisionOwner?.trim() || null;
        const parsedDecisionDeadline = row.decisionDeadline ? new Date(row.decisionDeadline) : null;
        const decisionDeadline = parsedDecisionDeadline && Number.isFinite(parsedDecisionDeadline.getTime()) ? parsedDecisionDeadline : null;
        const nextBudgetBase = row.nextBudgetBase === null || row.nextBudgetBase === undefined ? null : toDecimal(normalizeMoney(row.nextBudgetBase));
        const budgetAdjustReason = row.budgetAdjustReason?.trim() || null;
        const remark = row.remark?.trim() || null;
        const weeks = Array.isArray(row.weeks) ? row.weeks : [];

        return WEEK_NUMBERS.map((weekNumber) => {
          const week = weeks.find((item) => item.weekNumber === weekNumber);
          const salesAmount = normalizeMoney(week?.salesAmountOriginal);
          const adSpend = normalizeMoney(week?.adSpendOriginal);
          const salesBase = salesAmount * exchangeRate;
          const adSpendBase = adSpend * exchangeRate;

          return prisma.channelMetricPeriod.upsert({
            where: {
              year_month_periodType_weekNumber_channelId: {
                year,
                month,
                periodType: PERIOD_TYPE_WEEK,
                weekNumber,
                channelId: row.channelId,
              },
            },
            update: {
              quarter,
              brandId,
              platformId,
              storeId: channel.storeId,
              countryCode,
              currency,
              salesAmountOriginal: toDecimal(salesAmount),
              adSpendOriginal: toDecimal(adSpend),
              exchangeRate: new Prisma.Decimal(exchangeRate.toFixed(6)),
              salesAmountBase: toDecimal(salesBase),
              adSpendBase: toDecimal(adSpendBase),
              businessBlock,
              productCostBase: toDecimal(weekNumber === 1 ? productCostBase : 0),
              otherCostBase: toDecimal(weekNumber === 1 ? otherCostBase : 0),
              manualRating,
              ratingSource,
              aiAnalysisStatus,
              manualActionSuggestion,
              warningType,
              warningLevel,
              decisionOwner,
              decisionDeadline,
              nextBudgetBase: weekNumber === 1 ? nextBudgetBase : null,
              budgetAdjustReason,
              remark,
            },
            create: {
              year,
              month,
              quarter,
              weekNumber,
              periodType: PERIOD_TYPE_WEEK,
              brandId,
              platformId,
              storeId: channel.storeId,
              channelId: row.channelId,
              countryCode,
              currency,
              salesAmountOriginal: toDecimal(salesAmount),
              adSpendOriginal: toDecimal(adSpend),
              exchangeRate: new Prisma.Decimal(exchangeRate.toFixed(6)),
              salesAmountBase: toDecimal(salesBase),
              adSpendBase: toDecimal(adSpendBase),
              businessBlock,
              productCostBase: toDecimal(weekNumber === 1 ? productCostBase : 0),
              otherCostBase: toDecimal(weekNumber === 1 ? otherCostBase : 0),
              manualRating,
              ratingSource,
              aiAnalysisStatus,
              manualActionSuggestion,
              warningType,
              warningLevel,
              decisionOwner,
              decisionDeadline,
              nextBudgetBase: weekNumber === 1 ? nextBudgetBase : null,
              budgetAdjustReason,
              remark,
            },
          });
        });
      }),
    );

    const refreshedRows = await getMonthlyRows({ year, month });
    return NextResponse.json({ ok: true, rows: refreshedRows });
  } catch (error) {
    return apiError(error);
  }
}
