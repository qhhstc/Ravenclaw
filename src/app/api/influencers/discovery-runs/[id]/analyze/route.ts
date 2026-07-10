import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageInfluencerDiscovery, forbidden, requireApiSession } from "@/lib/permissions";
import { apiError, runInclude, serializeRun } from "@/lib/influencer-discovery/candidates";
import { canonicalDomain, fetchWebsiteContent, WebsiteFetchError } from "@/lib/influencer-discovery/website-analyzer";
import { analyzeWebsite } from "@/lib/influencer-discovery/ai";
import { autoDiscoverYoutubeCandidates, getYoutubeStatus, type AutoDiscoverySummary } from "@/lib/influencer-discovery/sources";

type Context = { params: Promise<{ id: string }> };

// 同步执行:抓取网站 → AI 分析 → 写回画像。V1 不做队列。
export async function POST(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const runId = Number(id);
  if (!Number.isInteger(runId) || runId <= 0) return NextResponse.json({ message: "无效的任务 ID" }, { status: 400 });

  try {
    const session = await requireApiSession();
    if (!canManageInfluencerDiscovery(session.role)) return forbidden("当前角色不能执行分析");

    const run = await prisma.influencerDiscoveryRun.findUnique({ where: { id: runId } });
    if (!run) return NextResponse.json({ message: "分析任务不存在" }, { status: 404 });

    await prisma.influencerDiscoveryRun.update({ where: { id: runId }, data: { status: "analyzing", errorMessage: null } });

    try {
      const content = await fetchWebsiteContent(run.websiteUrl);
      const analysis = await analyzeWebsite(content);
      const keywords = {
        keywords: analysis.keywords,
        creatorNiches: analysis.creatorNiches,
        platforms: analysis.platforms,
        negativeKeywords: analysis.negativeKeywords,
        primaryCategories: analysis.primaryCategories,
        priceBands: analysis.priceBands,
        targetRegions: analysis.targetRegions,
        recommendedOfferTypes: analysis.recommendedOfferTypes,
        keywordPool: analysis.keywordPool ?? null,
      };

      // 首次自动发现:YouTube 已启用 且 该 run 尚无 youtube_api 候选时才自动搜(重搜走 auto-discover 接口)。
      // 用独立 try/catch 隔离:任何 YouTube/自动发现错误都不影响网站分析的 completed 终态,绝不让 run failed。
      let autoDiscovery: AutoDiscoverySummary | undefined;
      try {
        const yt = getYoutubeStatus();
        if (yt.enabled && yt.configured) {
          const existingYoutube = await prisma.influencerCandidate.count({ where: { discoveryRunId: runId, source: "youtube_api" } });
          if (existingYoutube === 0) {
            autoDiscovery = await autoDiscoverYoutubeCandidates({ discoveryRunId: runId, analysis, runKeywords: analysis.keywords });
          }
        }
      } catch (autoError) {
        autoDiscovery = {
          enabled: true,
          searchedKeywords: [],
          found: 0,
          created: 0,
          skipped: 0,
          scored: 0,
          error: autoError instanceof Error ? autoError.message : "YouTube 自动搜索失败",
        };
      }

      const analysisJson: Record<string, unknown> = {
        ...analysis,
        content: { pageTitle: content.pageTitle, domain: content.domain },
      };
      if (autoDiscovery) analysisJson.youtubeAutoDiscovery = autoDiscovery;

      const updated = await prisma.influencerDiscoveryRun.update({
        where: { id: runId },
        data: {
          status: "completed",
          websiteDomain: canonicalDomain(content.domain),
          brandName: analysis.brandName || null,
          brandSummary: analysis.brandSummary || null,
          productSummary: analysis.productSummary || null,
          audienceSummary: analysis.audienceSummary || null,
          creatorPersona: analysis.creatorPersona || null,
          keywordsJson: keywords as Prisma.InputJsonValue,
          analysisJson: analysisJson as Prisma.InputJsonValue,
          errorMessage: null,
        },
        include: runInclude,
      });
      return NextResponse.json({ item: serializeRun(updated), aiGenerated: analysis.aiGenerated, autoDiscovery });
    } catch (analyzeError) {
      const messageText = analyzeError instanceof WebsiteFetchError || analyzeError instanceof Error ? analyzeError.message : "网站分析失败";
      const failed = await prisma.influencerDiscoveryRun.update({
        where: { id: runId },
        data: { status: "failed", errorMessage: messageText },
        include: runInclude,
      });
      return NextResponse.json({ item: serializeRun(failed), message: messageText }, { status: 200 });
    }
  } catch (error) {
    return apiError(error, "分析执行失败");
  }
}
