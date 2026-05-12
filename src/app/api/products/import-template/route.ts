import { createProductTemplateWorkbook, productWorkbookResponse } from "@/lib/product-excel";
import { apiError } from "@/lib/products";
import { canManageProducts, forbidden, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireApiSession();
    if (!canManageProducts(session.role)) return forbidden("当前角色不能下载产品导入模板");
    const workbook = await createProductTemplateWorkbook();
    return productWorkbookResponse(workbook, "产品导入模板.xlsx");
  } catch (error) {
    return apiError(error, "产品导入模板下载失败");
  }
}
