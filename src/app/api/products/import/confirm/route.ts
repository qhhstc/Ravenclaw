import { NextResponse, type NextRequest } from "next/server";
import { importProductRows } from "@/lib/product-excel";
import { apiError } from "@/lib/products";
import { canManageProducts, forbidden, requireApiSession } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canManageProducts(session.role)) return forbidden("当前角色不能导入产品");
    const input = (await request.json()) as { rows?: Array<Record<string, unknown>> };
    const rows = (input.rows ?? []).filter(Boolean);
    if (!rows.length) throw new Error("没有可导入的产品数据");
    const result = await importProductRows(rows);
    return NextResponse.json({ totalRows: rows.length, ...result });
  } catch (error) {
    return apiError(error, "产品导入失败");
  }
}
