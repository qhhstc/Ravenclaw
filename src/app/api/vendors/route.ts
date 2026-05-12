import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildVendorWhere, normalizeVendorInput, vendorApiError } from "@/lib/vendors";
import { canManageProducts, forbidden, requireApiSession } from "@/lib/permissions";
import { parsePositiveInt } from "@/lib/products";

export async function GET(request: NextRequest) {
  try {
    await requireApiSession();
    const params = request.nextUrl.searchParams;
    const page = parsePositiveInt(params.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(params.get("pageSize"), 10), 100);
    const where = buildVendorWhere(params);
    const [items, total] = await Promise.all([
      prisma.vendor.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.vendor.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    return vendorApiError(error, "供应商列表加载失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canManageProducts(session.role)) return forbidden("当前角色不能维护供应商");
    const input = (await request.json()) as Record<string, unknown>;
    const item = await prisma.vendor.create({ data: normalizeVendorInput(input) });
    return NextResponse.json({ item });
  } catch (error) {
    return vendorApiError(error, "供应商创建失败");
  }
}
