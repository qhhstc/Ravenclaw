import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logApiDuration } from "@/lib/api-logger";
import { apiError, buildProductWhere, normalizeProductInput, parsePositiveInt, productInclude } from "@/lib/products";
import { canManageProducts, forbidden, requireApiSession } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  try {
    await requireApiSession();
    const params = request.nextUrl.searchParams;
    const page = parsePositiveInt(params.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(params.get("pageSize"), 10), 20);
    const where = buildProductWhere(params);
    const [items, total] = await Promise.all([
      prisma.product.findMany({ where, include: productInclude, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.product.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    return apiError(error, "产品列表加载失败");
  } finally {
    logApiDuration("/api/products", startedAt);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canManageProducts(session.role)) return forbidden("当前角色不能维护产品库");
    const input = (await request.json()) as Record<string, unknown>;
    const item = await prisma.product.create({ data: normalizeProductInput(input), include: productInclude });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "产品创建失败");
  }
}
