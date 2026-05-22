import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, normalizeContactInput } from "@/lib/crm";
import { canManageCrm, canViewCrm, forbidden, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canViewCrm(session.role)) return forbidden("当前角色不能查看联系人");
    const { id } = await context.params;
    const items = await prisma.customerContact.findMany({
      where: { customerId: Number(id) },
      orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
    });
    return NextResponse.json({ items });
  } catch (error) {
    return apiError(error, "联系人加载失败");
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageCrm(session.role)) return forbidden("当前角色不能维护联系人");
    const { id } = await context.params;
    const input = (await request.json()) as Record<string, unknown>;
    const data = normalizeContactInput(input);
    const item = await prisma.$transaction(async (tx) => {
      if (data.isPrimary) {
        await tx.customerContact.updateMany({ where: { customerId: Number(id) }, data: { isPrimary: false } });
      }
      return tx.customerContact.create({ data: { ...data, customerId: Number(id) } });
    });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "联系人创建失败");
  }
}
