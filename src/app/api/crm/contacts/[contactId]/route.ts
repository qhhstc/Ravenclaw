import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, normalizeContactInput } from "@/lib/crm";
import { canManageCrm, forbidden, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ contactId: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageCrm(session.role)) return forbidden("当前角色不能维护联系人");
    const { contactId } = await context.params;
    const input = (await request.json()) as Record<string, unknown>;
    const data = normalizeContactInput(input);
    const existing = await prisma.customerContact.findUniqueOrThrow({ where: { id: Number(contactId) } });
    const item = await prisma.$transaction(async (tx) => {
      if (data.isPrimary) {
        await tx.customerContact.updateMany({ where: { customerId: existing.customerId }, data: { isPrimary: false } });
      }
      return tx.customerContact.update({ where: { id: Number(contactId) }, data });
    });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "联系人保存失败");
  }
}

export async function PUT(request: NextRequest, context: Context) {
  return PATCH(request, context);
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageCrm(session.role)) return forbidden("当前角色不能删除联系人");
    const { contactId } = await context.params;
    await prisma.customerContact.delete({ where: { id: Number(contactId) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "联系人删除失败");
  }
}
