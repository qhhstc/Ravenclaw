import { NextResponse, type NextRequest } from "next/server";
import { previewProductWorkbook } from "@/lib/product-excel";
import { apiError } from "@/lib/products";
import { canManageProducts, forbidden, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canManageProducts(session.role)) return forbidden("当前角色不能导入产品");
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("请上传 .xlsx 文件");
    if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("仅支持 .xlsx 文件");
    if (file.size > MAX_FILE_SIZE) throw new Error("文件不能超过 10MB");
    const rows = await previewProductWorkbook(await file.arrayBuffer());
    return NextResponse.json({
      totalRows: rows.length,
      successRows: rows.filter((row) => row.valid).length,
      failedRows: rows.filter((row) => !row.valid).length,
      rows,
    });
  } catch (error) {
    return apiError(error, "产品导入预览失败");
  }
}
