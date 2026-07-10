import { NextResponse, type NextRequest } from "next/server";
import { canManageInfluencerDiscovery, forbidden, requireApiSession } from "@/lib/permissions";
import { apiError } from "@/lib/influencer-discovery/candidates";
import { parseCandidateCsv } from "@/lib/influencer-discovery/csv";

const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5MB

// 从请求读取原始 CSV 文本(支持 multipart 文件或 text/plain body)
async function readCsvText(request: NextRequest): Promise<string> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("请上传 CSV 文件");
    if (file.size > MAX_CSV_BYTES) throw new Error("CSV 文件不能超过 5MB");
    return await file.text();
  }
  const text = await request.text();
  if (text.length > MAX_CSV_BYTES) throw new Error("CSV 内容过大");
  return text;
}

// 预览阶段:解析 + 校验,返回结果供前端展示,不写库。
export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canManageInfluencerDiscovery(session.role)) return forbidden("当前角色不能导入候选红人");
    const csvText = await readCsvText(request);
    const result = parseCandidateCsv(csvText);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, "CSV 解析失败");
  }
}
