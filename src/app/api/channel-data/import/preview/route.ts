import { parseChannelImportWorkbook, validateImportFile } from "@/lib/channel-data-excel";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ message: "请上传 .xlsx 文件" }, { status: 400 });
    }

    validateImportFile(file);
    const preview = await parseChannelImportWorkbook(file.name, await file.arrayBuffer());
    return Response.json(preview);
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "解析 Excel 失败" },
      { status: 400 },
    );
  }
}
