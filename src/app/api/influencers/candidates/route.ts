import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageInfluencerDiscovery, forbidden, requireApiSession } from "@/lib/permissions";
import { parsePositiveInt } from "@/lib/influencers";
import {
  apiError,
  buildCandidateOrderBy,
  buildCandidateWhere,
  candidateInclude,
  normalizeCandidateInput,
  serializeCandidate,
} from "@/lib/influencer-discovery/candidates";

export async function GET(request: NextRequest) {
  try {
    await requireApiSession();
    const params = request.nextUrl.searchParams;
    const page = parsePositiveInt(params.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(params.get("pageSize"), 20), 100);
    const where = buildCandidateWhere(params);
    const orderBy = buildCandidateOrderBy(params.get("sort"));
    const [rawItems, total] = await Promise.all([
      prisma.influencerCandidate.findMany({
        where,
        include: candidateInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.influencerCandidate.count({ where }),
    ]);
    return NextResponse.json({ items: rawItems.map(serializeCandidate), total, page, pageSize });
  } catch (error) {
    return apiError(error, "候选红人列表加载失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canManageInfluencerDiscovery(session.role)) return forbidden("当前角色不能新增候选红人");
    const input = (await request.json()) as Record<string, unknown>;
    const data = normalizeCandidateInput(input, "manual");
    const discoveryRunId = Number(input.discoveryRunId);
    const item = await prisma.influencerCandidate.create({
      data: {
        ...data,
        ...(Number.isInteger(discoveryRunId) && discoveryRunId > 0 ? { discoveryRunId } : {}),
      },
      include: candidateInclude,
    });
    return NextResponse.json({ item: serializeCandidate(item) });
  } catch (error) {
    return apiError(error, "候选红人创建失败");
  }
}
