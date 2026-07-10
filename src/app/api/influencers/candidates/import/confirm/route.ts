import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageInfluencerDiscovery, forbidden, requireApiSession } from "@/lib/permissions";
import { apiError } from "@/lib/influencer-discovery/candidates";
import { parseCandidateCsv } from "@/lib/influencer-discovery/csv";

const MAX_CSV_BYTES = 5 * 1024 * 1024;

// confirm 阶段接收原始 CSV(而非前端回传的 preview rows),重新解析+校验+只写 valid 行。
async function readConfirmPayload(request: NextRequest): Promise<{ csvText: string; discoveryRunId: number | null }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("请上传 CSV 文件");
    if (file.size > MAX_CSV_BYTES) throw new Error("CSV 文件不能超过 5MB");
    const runId = Number(formData.get("discoveryRunId"));
    return { csvText: await file.text(), discoveryRunId: Number.isInteger(runId) && runId > 0 ? runId : null };
  }
  const body = (await request.json()) as { csv?: unknown; discoveryRunId?: unknown };
  if (typeof body.csv !== "string") throw new Error("缺少 CSV 内容");
  if (body.csv.length > MAX_CSV_BYTES) throw new Error("CSV 内容过大");
  const runId = Number(body.discoveryRunId);
  return { csvText: body.csv, discoveryRunId: Number.isInteger(runId) && runId > 0 ? runId : null };
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canManageInfluencerDiscovery(session.role)) return forbidden("当前角色不能导入候选红人");
    const { csvText, discoveryRunId } = await readConfirmPayload(request);

    // 重新解析,绝不信任前端回传的行
    const parsed = parseCandidateCsv(csvText);
    const validRows = parsed.rows.filter((r) => r.valid && r.data);
    if (!validRows.length) throw new Error("没有可导入的有效行");

    // 若指定 discoveryRunId,校验其存在
    if (discoveryRunId) {
      const run = await prisma.influencerDiscoveryRun.findUnique({ where: { id: discoveryRunId }, select: { id: true } });
      if (!run) throw new Error("指定的分析任务不存在");
    }

    const result = await prisma.influencerCandidate.createMany({
      data: validRows.map((r) => {
        const d = r.data!;
        return {
          discoveryRunId,
          platform: d.platform,
          handle: d.handle,
          displayName: d.displayName,
          profileUrl: d.profileUrl,
          email: d.email,
          country: d.country,
          followers: d.followers,
          avgViews: d.avgViews,
          engagementRate: d.engagementRate === null ? null : new Prisma.Decimal(d.engagementRate.toFixed(4)),
          nicheTagsJson: d.nicheTags.length ? (d.nicheTags as Prisma.InputJsonValue) : Prisma.DbNull,
          status: "new",
          source: "csv",
        };
      }),
    });

    return NextResponse.json({
      ok: true,
      totalRows: parsed.totalRows,
      successRows: result.count,
      failedRows: parsed.failedRows,
    });
  } catch (error) {
    return apiError(error, "CSV 导入失败");
  }
}
