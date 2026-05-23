import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, assertCanAccessCustomer, normalizeFollowupInput } from "@/lib/crm";
import { canManageCrm, canViewCrm, forbidden, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canViewCrm(session.role)) return forbidden("当前角色不能查看跟进记录");
    const { id } = await context.params;
    await assertCanAccessCustomer(prisma, Number(id), session);
    const items = await prisma.customerFollowup.findMany({
      where: { customerId: Number(id) },
      include: { owner: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ items });
  } catch (error) {
    return apiError(error, "跟进记录加载失败");
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageCrm(session.role)) return forbidden("当前角色不能维护跟进记录");
    const { id } = await context.params;
    await assertCanAccessCustomer(prisma, Number(id), session);
    const input = (await request.json()) as Record<string, unknown>;
    const data = normalizeFollowupInput({ ...input, ownerId: input.ownerId || session?.userId });
    const now = new Date();
    const item = await prisma.$transaction(async (tx) => {
      const followup = await tx.customerFollowup.create({
        data: { ...data, customerId: Number(id), createdAt: now },
        include: { owner: { select: { id: true, name: true, email: true } } },
      });
      await tx.customer.update({
        where: { id: Number(id) },
        data: { lastFollowupAt: followup.createdAt, nextFollowupAt: data.nextFollowupAt },
      });
      return followup;
    });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "跟进记录创建失败");
  }
}
