import { NextResponse, type NextRequest } from "next/server";
import { apiError, influencerInclude, normalizeInfluencerInput } from "@/lib/influencers";
import { prisma } from "@/lib/prisma";
import { canManageInfluencers, forbidden, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requireApiSession();
    const { id } = await context.params;
    const item = await prisma.influencerCollaboration.findUnique({ where: { id: Number(id) }, include: influencerInclude });
    if (!item) return NextResponse.json({ message: "红人合作记录不存在或已删除" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "红人合作详情加载失败");
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageInfluencers(session.role)) return forbidden("当前角色不能维护红人合作");
    const { id } = await context.params;
    const input = (await request.json()) as Record<string, unknown>;
    const item = await prisma.influencerCollaboration.update({ where: { id: Number(id) }, data: normalizeInfluencerInput(input), include: influencerInclude });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "红人合作保存失败");
  }
}

export async function PUT(request: NextRequest, context: Context) {
  return PATCH(request, context);
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageInfluencers(session.role)) return forbidden("当前角色不能删除红人合作");
    const { id } = await context.params;
    await prisma.influencerCollaboration.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "红人合作删除失败");
  }
}

