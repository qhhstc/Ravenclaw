import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { decimal, toNumber } from "@/lib/order-profit-calculations";
import { ApiAuthError } from "@/lib/permissions";

export const influencerInclude = {
  brand: { select: { id: true, name: true, code: true } },
  channel: { select: { id: true, businessLine: true, channelName: true } },
  owner: { select: { id: true, name: true, email: true } },
} satisfies Prisma.InfluencerCollaborationInclude;

export const influencerStatuses = ["prospecting", "contacted", "sample_sent", "content_pending", "published", "settled", "cancelled"] as const;
export const cooperationTypes = ["sample", "paid_post", "commission", "affiliate", "long_term", "other"] as const;

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function nonNegativeInt(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(Math.floor(numeric), 0) : 0;
}

function optionalDate(value: unknown) {
  const text = textValue(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function parsePositiveInt(value: string | null, fallback: number) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

export function apiError(error: unknown, fallback = "红人合作操作失败") {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return NextResponse.json({ message: "红人合作记录不存在或已删除" }, { status: 404 });
  }
  return NextResponse.json({ message: error instanceof Error ? error.message : fallback }, { status: 400 });
}

export function buildInfluencerWhere(params: URLSearchParams): Prisma.InfluencerCollaborationWhereInput {
  const keyword = params.get("keyword")?.trim();
  return {
    ...(keyword
      ? {
          OR: [
            { influencerName: { contains: keyword } },
            { accountHandle: { contains: keyword } },
            { platform: { contains: keyword } },
            { contentCategory: { contains: keyword } },
            { couponCode: { contains: keyword } },
          ],
        }
      : {}),
    ...(params.get("status") ? { status: params.get("status")! } : {}),
    ...(params.get("platform") ? { platform: params.get("platform")! } : {}),
    ...(params.get("cooperationType") ? { cooperationType: params.get("cooperationType")! } : {}),
    ...(params.get("brandId") ? { brandId: Number(params.get("brandId")) } : {}),
    ...(params.get("ownerId") ? { ownerId: Number(params.get("ownerId")) } : {}),
  };
}

export function normalizeInfluencerInput(input: Record<string, unknown>) {
  const influencerName = textValue(input.influencerName);
  const platform = textValue(input.platform);
  if (!influencerName) throw new Error("红人名称不能为空");
  if (!platform) throw new Error("平台不能为空");

  const sampleCost = Math.max(toNumber(input.sampleCost), 0);
  const feeAmount = Math.max(toNumber(input.feeAmount), 0);
  const exchangeRate = Math.max(toNumber(input.exchangeRate, 1), 0);
  const totalCostBase = (sampleCost + feeAmount) * exchangeRate;
  const salesAmount = Math.max(toNumber(input.salesAmount), 0);
  const salesBase = salesAmount * exchangeRate;
  const roi = totalCostBase > 0 ? salesBase / totalCostBase : null;

  return {
    influencerName,
    platform,
    accountHandle: textValue(input.accountHandle),
    profileUrl: textValue(input.profileUrl),
    countryCode: textValue(input.countryCode)?.toUpperCase(),
    followerCount: nonNegativeInt(input.followerCount),
    avgViews: nonNegativeInt(input.avgViews),
    contentCategory: textValue(input.contentCategory),
    cooperationType: textValue(input.cooperationType) ?? "sample",
    status: textValue(input.status) ?? "prospecting",
    brandId: optionalNumber(input.brandId),
    channelId: optionalNumber(input.channelId),
    ownerId: optionalNumber(input.ownerId),
    contactName: textValue(input.contactName),
    email: textValue(input.email),
    whatsapp: textValue(input.whatsapp),
    startDate: optionalDate(input.startDate),
    endDate: optionalDate(input.endDate),
    sampleSku: textValue(input.sampleSku),
    sampleQuantity: nonNegativeInt(input.sampleQuantity),
    sampleCost: decimal(sampleCost),
    feeAmount: decimal(feeAmount),
    currency: textValue(input.currency)?.toUpperCase() ?? "USD",
    exchangeRate: new Prisma.Decimal(exchangeRate.toFixed(6)),
    totalCostBase: decimal(totalCostBase),
    contentCount: nonNegativeInt(input.contentCount),
    postUrl: textValue(input.postUrl),
    couponCode: textValue(input.couponCode),
    salesAmount: decimal(salesAmount),
    orderCount: nonNegativeInt(input.orderCount),
    roi: roi === null ? null : new Prisma.Decimal(roi.toFixed(6)),
    rating: textValue(input.rating),
    nextFollowupAt: optionalDate(input.nextFollowupAt),
    remark: textValue(input.remark),
  };
}

