import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { decimal, toNumber } from "@/lib/order-profit-calculations";
import { ApiAuthError } from "@/lib/permissions";

export const productInclude = {
  defaultVendor: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true, code: true } },
} satisfies Prisma.ProductInclude;

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

export function apiError(error: unknown, fallback = "产品操作失败") {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return NextResponse.json({ message: "SKU 已存在，请检查" }, { status: 409 });
    if (error.code === "P2025") return NextResponse.json({ message: "产品不存在或已删除" }, { status: 404 });
  }
  return NextResponse.json({ message: error instanceof Error ? error.message : fallback }, { status: 400 });
}

export function parsePositiveInt(value: string | null, fallback: number) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

export function buildProductWhere(params: URLSearchParams): Prisma.ProductWhereInput {
  const keyword = params.get("keyword")?.trim();
  return {
    ...(keyword ? { OR: [{ sku: { contains: keyword } }, { name: { contains: keyword } }, { specification: { contains: keyword } }, { category: { contains: keyword } }] } : {}),
    ...(params.get("status") ? { status: params.get("status")! } : {}),
    ...(params.get("category") ? { category: params.get("category")! } : {}),
  };
}

export function normalizeProductInput(input: Record<string, unknown>) {
  const sku = textValue(input.sku)?.toUpperCase();
  const name = textValue(input.name);
  if (!sku) throw new Error("SKU 不能为空");
  if (!name) throw new Error("产品名称不能为空");
  return {
    sku,
    name,
    specification: textValue(input.specification),
    category: textValue(input.category),
    defaultPurchasePrice: decimal(Math.max(toNumber(input.defaultPurchasePrice), 0)),
    defaultPackagingCost: decimal(Math.max(toNumber(input.defaultPackagingCost), 0)),
    currency: textValue(input.currency)?.toUpperCase() ?? "CNY",
    weight: input.weight === null || input.weight === undefined || input.weight === "" ? null : new Prisma.Decimal(toNumber(input.weight).toFixed(3)),
    volume: input.volume === null || input.volume === undefined || input.volume === "" ? null : new Prisma.Decimal(toNumber(input.volume).toFixed(3)),
    defaultVendorId: optionalNumber(input.defaultVendorId),
    brandId: optionalNumber(input.brandId),
    status: textValue(input.status) ?? "active",
    remark: textValue(input.remark),
  };
}
