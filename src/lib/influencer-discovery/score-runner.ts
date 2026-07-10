import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scoreCandidate } from "./scoring";
import { scoreCandidateWithAi } from "./ai";
import { runToBrandAnalysis, toScoringInput } from "./candidates";
import type { WebsiteAnalysis } from "./types";

// 对单个候选红人评分并写库。品牌画像可外部传入(批量时复用),否则按其绑定的 run 还原。
export async function scoreCandidateById(candidateId: number, brandOverride?: WebsiteAnalysis) {
  const candidate = await prisma.influencerCandidate.findUnique({
    where: { id: candidateId },
    include: { discoveryRun: true },
  });
  if (!candidate) throw new Error("候选红人不存在");

  const brand = brandOverride ?? runToBrandAnalysis(candidate.discoveryRun);
  const scoringInput = toScoringInput(candidate);

  // AI 只提供 hint(不可信);scoring.ts 会 clamp + 重算 total
  const aiHint = await scoreCandidateWithAi(scoringInput, brand);
  const result = scoreCandidate(scoringInput, brand, aiHint ?? undefined);

  const updated = await prisma.influencerCandidate.update({
    where: { id: candidateId },
    data: {
      score: result.score,
      tier: result.tier,
      recommendedOffer: result.recommendedOffer,
      scoreDetailsJson: result.scoreDetails as unknown as Prisma.InputJsonValue,
      aiReason: result.aiReason || null,
      riskNotes: result.riskNotes || null,
      // 已评分且尚未进入人工流转状态时,标记为 scored
      status: candidate.status === "new" ? "scored" : candidate.status,
    },
  });
  return updated;
}
