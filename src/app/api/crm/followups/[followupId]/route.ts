import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, assertCanAccessFollowup, normalizeFollowupInput } from "@/lib/crm";
import { canManageCrm, forbidden, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ followupId: string }> };

async function syncCustomerFollowupState(customerId: number) {
  const latest = await prisma.customerFollowup.findFirst({ where: { customerId }, orderBy: { createdAt: "desc" } });
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      lastFollowupAt: latest?.createdAt ?? null,
      nextFollowupAt: latest?.nextFollowupAt ?? null,
    },
  });
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageCrm(session.role)) return forbidden("当前角色不能维护跟进记录");
    const { followupId } = await context.params;
    await assertCanAccessFollowup(prisma, Number(followupId), session);
    const input = (await request.json()) as Record<string, unknown>;
    const data = normalizeFollowupInput(input);
    const item = await prisma.customerFollowup.update({
      where: { id: Number(followupId) },
      data,
      include: { owner: { select: { id: true, name: true, email: true } } },
    });
    await syncCustomerFollowupState(item.customerId);
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "跟进记录保存失败");
  }
}

export async function PUT(request: NextRequest, context: Context) {
  return PATCH(request, context);
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageCrm(session.role)) return forbidden("当前角色不能删除跟进记录");
    const { followupId } = await context.params;
    await assertCanAccessFollowup(prisma, Number(followupId), session);
    const item = await prisma.customerFollowup.delete({ where: { id: Number(followupId) } });
    await syncCustomerFollowupState(item.customerId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "跟进记录删除失败");
  }
}
