import {
  createChannelImportTemplateWorkbook,
  templateFileName,
  workbookToResponse,
} from "@/lib/channel-data-excel";

export const runtime = "nodejs";

export async function GET() {
  try {
    const workbook = await createChannelImportTemplateWorkbook();
    return workbookToResponse(workbook, templateFileName());
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "下载导入模板失败" },
      { status: 400 },
    );
  }
}
