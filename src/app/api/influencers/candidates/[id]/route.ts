import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageInfluencerDiscovery, forbidden, requireApiSession } from "@/lib/permissions";
import {
  apiError,
  candidateInclude,
  optionalInt,
  optionalRate,
  serializeCandidate,
  textValue,
} from "@/lib/influencer-discovery/candidates";
import { CANDIDATE_STATUSES } from "@/lib/influencer-discovery/types";

type Context = { params: Promise<{ id: string }> };

async function findId(context: Context) {
  const { id } = await context.params;
  const candidateId = Number(id);
  if (!Number.isInteger(candidateId) || candidateId <= 0) return null;
  return candidateId;
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requireApiSession();
    const candidateId = await findId(context);
    if (!candidateId) return NextResponse.json({ message: "无效的候选红人 ID" }, { status: 400 });
    const item = await prisma.influencerCandidate.findUnique({ where: { id: candidateId }, include: candidateInclude });
    if (!item) return NextResponse.json({ message: "候选红人不存在" }, { status: 404 });
    return NextResponse.json({ item: serializeCandidate(item) });
  } catch (error) {
    return apiError(error, "候选红人详情加载失败");
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageInfluencerDiscovery(session.role)) return forbidden("当前角色不能修改候选红人");
    const candidateId = await findId(context);
    if (!candidateId) return NextResponse.json({ message: "无效的候选红人 ID" }, { status: 400 });
    const input = (await request.json()) as Record<string, unknown>;

    // 只允许更新白名单字段(避免前端覆盖评分/关系等)
    const data: Prisma.InfluencerCandidateUpdateInput = {};
    if ("status" in input) {
      const status = textValue(input.status);
      if (!status || !CANDIDATE_STATUSES.includes(status as (typeof CANDIDATE_STATUSES)[number])) throw new Error("无效的状态值");
      data.status = status;
    }
    if ("notes" in input) data.notes = textValue(input.notes);
    if ("displayName" in input) data.displayName = textValue(input.displayName);
    if ("email" in input) {
      const email = textValue(input.email);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("邮箱格式不正确");
      data.email = email;
    }
    if ("country" in input) data.country = textValue(input.country)?.toUpperCase() ?? null;
    if ("language" in input) data.language = textValue(input.language);
    if ("followers" in input) data.followers = optionalInt(input.followers);
    if ("avgViews" in input) data.avgViews = optionalInt(input.avgViews);
    if ("engagementRate" in input) data.engagementRate = optionalRate(input.engagementRate);
    if ("recommendedProducts" in input) data.recommendedProducts = textValue(input.recommendedProducts);

    const item = await prisma.influencerCandidate.update({ where: { id: candidateId }, data, include: candidateInclude });
    return NextResponse.json({ item: serializeCandidate(item) });
  } catch (error) {
    return apiError(error, "候选红人更新失败");
  }
}
