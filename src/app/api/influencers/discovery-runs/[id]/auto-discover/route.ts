import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageInfluencerDiscovery, forbidden, requireApiSession } from "@/lib/permissions";
import { apiError, runInclude, runToBrandAnalysis, serializeRun } from "@/lib/influencer-discovery/candidates";
import { autoDiscoverYoutubeCandidates, getYoutubeStatus } from "@/lib/influencer-discovery/sources";
import type { KeywordPool, WebsiteAnalysis } from "@/lib/influencer-discovery/types";

type Context = { params: Promise<{ id: string }> };

// 从 run 已存的 analysisJson 还原 WebsiteAnalysis(含 keywordPool),不重新抓网站/跑 AI
function runToAnalysis(run: {
  brandName: string | null;
  brandSummary: string | null;
  productSummary: string | null;
  audienceSummary: string | null;
  creatorPersona: string | null;
  keywordsJson: Prisma.JsonValue | null;
  analysisJson: Prisma.JsonValue | null;
}): WebsiteAnalysis {
  const base = runToBrandAnalysis(run)!; // run 非空,必返回
  const aj = (run.analysisJson && typeof run.analysisJson === "object" && !Array.isArray(run.analysisJson) ? run.analysisJson : {}) as Record<string, unknown>;
  const kp = aj.keywordPool;
  const keywordPool: KeywordPool | undefined =
    kp && typeof kp === "object" && !Array.isArray(kp)
      ? {
          highIntentKeywords: strArr((kp as Record<string, unknown>).highIntentKeywords),
          ipKeywords: strArr((kp as Record<string, unknown>).ipKeywords),
          contentFormatKeywords: strArr((kp as Record<string, unknown>).contentFormatKeywords),
          creatorNicheKeywords: strArr((kp as Record<string, unknown>).creatorNicheKeywords),
          negativeKeywords: strArr((kp as Record<string, unknown>).negativeKeywords),
        }
      : undefined;
  return { ...base, keywordPool };
}

function strArr(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];
}

// 「重新自动搜索」:基于当前画像重搜 YouTube 并导入评分,不重新分析网站。写权限。
export async function POST(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageInfluencerDiscovery(session.role)) return forbidden("当前角色不能执行自动搜索");
    const { id } = await context.params;
    const runId = Number(id);
    if (!Number.isInteger(runId) || runId <= 0) return NextResponse.json({ message: "无效的任务 ID" }, { status: 400 });

    const run = await prisma.influencerDiscoveryRun.findUnique({ where: { id: runId } });
    if (!run) return NextResponse.json({ message: "分析任务不存在" }, { status: 404 });

    const status = getYoutubeStatus();
    if (!status.enabled || !status.configured) {
      return NextResponse.json({ error: "YouTube 数据源未配置", enabled: false }, { status: 503 });
    }

    const analysis = runToAnalysis(run);
    const summary = await autoDiscoverYoutubeCandidates({ discoveryRunId: runId, analysis, runKeywords: analysis.keywords });

    // 写回 analysisJson.youtubeAutoDiscovery(合并,不动其他字段)
    const prevAnalysis = (run.analysisJson && typeof run.analysisJson === "object" && !Array.isArray(run.analysisJson) ? run.analysisJson : {}) as Record<string, unknown>;
    const updated = await prisma.influencerDiscoveryRun.update({
      where: { id: runId },
      data: { analysisJson: { ...prevAnalysis, youtubeAutoDiscovery: summary } as Prisma.InputJsonValue },
      include: runInclude,
    });

    return NextResponse.json({ item: serializeRun(updated), autoDiscovery: summary });
  } catch (error) {
    return apiError(error, "自动搜索失败");
  }
}
