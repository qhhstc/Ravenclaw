import { getSession } from "@/lib/auth";
import { importChannelRows, type ChannelImportRow } from "@/lib/channel-data-excel";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as {
      fileName?: string;
      rows?: ChannelImportRow[];
      previewFailedRows?: number;
      previewTotalRows?: number;
    };
    const rows = Array.isArray(input.rows) ? input.rows : [];
    if (rows.length === 0) {
      return Response.json({ message: "没有可导入的数据" }, { status: 400 });
    }

    const session = await getSession();
    const result = await importChannelRows({
      fileName: input.fileName || "渠道数据导入.xlsx",
      rows,
      createdBy: session?.userId,
      previewFailedRows: input.previewFailedRows ?? 0,
      previewTotalRows: input.previewTotalRows,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "确认导入失败" },
      { status: 400 },
    );
  }
}
