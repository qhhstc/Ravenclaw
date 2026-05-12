import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeVendorInput, vendorApiError } from "@/lib/vendors";
import { canManageProducts, forbidden, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requireApiSession();
    const { id } = await context.params;
    const item = await prisma.vendor.findUnique({ where: { id: Number(id) } });
    if (!item) return NextResponse.json({ message: "供应商不存在或已删除" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return vendorApiError(error, "供应商详情加载失败");
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageProducts(session.role)) return forbidden("当前角色不能维护供应商");
    const { id } = await context.params;
    const input = (await request.json()) as Record<string, unknown>;
    const item = await prisma.vendor.update({ where: { id: Number(id) }, data: normalizeVendorInput(input) });
    return NextResponse.json({ item });
  } catch (error) {
    return vendorApiError(error, "供应商保存失败");
  }
}

export async function PUT(request: NextRequest, context: Context) {
  return PATCH(request, context);
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageProducts(session.role)) return forbidden("当前角色不能删除供应商");
    const { id } = await context.params;
    await prisma.vendor.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return vendorApiError(error, "供应商删除失败");
  }
}
