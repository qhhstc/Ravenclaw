import { importChannelRows, type ChannelImportRow } from "@/lib/channel-data-excel";
import { ApiAuthError, forbidden, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireApiSession();
    if (session.role !== "admin") return forbidden("当前角色不能导入渠道经营数据");
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

    const result = await importChannelRows({
      fileName: input.fileName || "渠道数据导入.xlsx",
      rows,
      createdBy: session.userId,
      previewFailedRows: input.previewFailedRows ?? 0,
      previewTotalRows: input.previewTotalRows,
    });

    return Response.json(result);
  } catch (error) {
    if (error instanceof ApiAuthError) return Response.json({ message: error.message }, { status: error.status });
    return Response.json(
      { message: error instanceof Error ? error.message : "确认导入失败" },
      { status: 400 },
    );
  }
}
