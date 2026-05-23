import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, customerDetailInclude, customerInclude, normalizeCustomerInputForSession, scopedCustomerUniqueWhere } from "@/lib/crm";
import { canManageCrm, canViewCrm, forbidden, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canViewCrm(session.role)) return forbidden("当前角色不能查看客户资料");
    const { id } = await context.params;
    const item = await prisma.customer.findFirst({ where: scopedCustomerUniqueWhere(Number(id), session), include: customerDetailInclude });
    if (!item) return NextResponse.json({ message: "客户不存在或已被删除" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "客户详情加载失败");
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageCrm(session.role)) return forbidden("当前角色不能维护客户资料");
    const { id } = await context.params;
    const input = (await request.json()) as Record<string, unknown>;
    const existing = await prisma.customer.findFirst({ where: scopedCustomerUniqueWhere(Number(id), session), select: { id: true } });
    if (!existing) return forbidden("客户不存在或无权维护");
    const item = await prisma.customer.update({ where: { id: Number(id) }, data: normalizeCustomerInputForSession(input, session), include: customerInclude });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "客户保存失败");
  }
}

export async function PUT(request: NextRequest, context: Context) {
  return PATCH(request, context);
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageCrm(session.role)) return forbidden("当前角色不能删除客户资料");
    const { id } = await context.params;
    const existing = await prisma.customer.findFirst({ where: scopedCustomerUniqueWhere(Number(id), session), select: { id: true } });
    if (!existing) return forbidden("客户不存在或无权删除");
    await prisma.customer.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "客户删除失败");
  }
}
