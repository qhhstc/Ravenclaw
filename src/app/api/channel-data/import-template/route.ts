import {
  createChannelImportTemplateWorkbook,
  templateFileName,
  workbookToResponse,
} from "@/lib/channel-data-excel";
import { ApiAuthError, forbidden, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireApiSession();
    if (session.role !== "admin") return forbidden("当前角色不能下载渠道导入模板");
    const workbook = await createChannelImportTemplateWorkbook();
    return workbookToResponse(workbook, templateFileName());
  } catch (error) {
    if (error instanceof ApiAuthError) return Response.json({ message: error.message }, { status: error.status });
    return Response.json(
      { message: error instanceof Error ? error.message : "下载导入模板失败" },
      { status: 400 },
    );
  }
}
