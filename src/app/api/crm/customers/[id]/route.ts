import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, customerDetailInclude, customerInclude, normalizeCustomerInput } from "@/lib/crm";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const item = await prisma.customer.findUnique({ where: { id: Number(id) }, include: customerDetailInclude });
    if (!item) return NextResponse.json({ message: "客户不存在或已被删除" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "客户详情加载失败");
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const input = (await request.json()) as Record<string, unknown>;
    const item = await prisma.customer.update({ where: { id: Number(id) }, data: normalizeCustomerInput(input), include: customerInclude });
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
    const { id } = await context.params;
    await prisma.customer.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "客户删除失败");
  }
}
