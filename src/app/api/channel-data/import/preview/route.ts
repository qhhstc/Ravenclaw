import { parseChannelImportWorkbook, validateImportFile } from "@/lib/channel-data-excel";
import { ApiAuthError, forbidden, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireApiSession();
    if (session.role !== "admin") return forbidden("当前角色不能导入渠道经营数据");
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ message: "请上传 .xlsx 文件" }, { status: 400 });
    }

    validateImportFile(file);
    const preview = await parseChannelImportWorkbook(file.name, await file.arrayBuffer());
    return Response.json(preview);
  } catch (error) {
    if (error instanceof ApiAuthError) return Response.json({ message: error.message }, { status: error.status });
    return Response.json(
      { message: error instanceof Error ? error.message : "解析 Excel 失败" },
      { status: 400 },
    );
  }
}
