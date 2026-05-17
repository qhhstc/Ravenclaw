import { NextResponse, type NextRequest } from "next/server";
import { apiError, inquiryInclude, normalizeInquiryInput } from "@/lib/quotes";
import { prisma } from "@/lib/prisma";
import { canManageSalesFlow, forbidden, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requireApiSession();
    const { id } = await context.params;
    const item = await prisma.inquiry.findUnique({ where: { id: Number(id) }, include: inquiryInclude });
    if (!item) return NextResponse.json({ message: "询盘不存在或已删除" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "询盘详情加载失败");
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageSalesFlow(session.role)) return forbidden("当前角色不能编辑询盘");
    const { id } = await context.params;
    const input = (await request.json()) as Record<string, unknown>;
    const item = await prisma.inquiry.update({ where: { id: Number(id) }, data: normalizeInquiryInput(input), include: inquiryInclude });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "询盘保存失败");
  }
}

export async function PUT(request: NextRequest, context: Context) {
  return PATCH(request, context);
}
