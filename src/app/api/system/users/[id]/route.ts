import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { normalizeUserInput, systemUserApiError, userSelect } from "@/lib/system-users";
import { canManageAccounts, forbidden, requireApiSession } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

function numericId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error("账号 ID 不正确");
  return id;
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageAccounts(session.role)) return forbidden("当前角色不能管理账号");

    const { id } = await context.params;
    const item = await prisma.user.findUnique({ where: { id: numericId(id) }, select: userSelect });
    if (!item) return NextResponse.json({ message: "账号不存在或已删除" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return systemUserApiError(error, "账号详情加载失败");
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageAccounts(session.role)) return forbidden("当前角色不能管理账号");

    const { id } = await context.params;
    const userId = numericId(id);
    const input = (await request.json()) as Record<string, unknown>;
    const values = normalizeUserInput(input, { requirePassword: false });

    if (userId === session.userId && values.status !== "active") {
      return NextResponse.json({ message: "不能停用当前登录账号" }, { status: 400 });
    }
    if (userId === session.userId && values.role !== "admin") {
      return NextResponse.json({ message: "不能移除当前登录账号的管理员角色" }, { status: 400 });
    }

    const item = await prisma.user.update({
      where: { id: userId },
      data: {
        name: values.name,
        email: values.email,
        role: values.role,
        status: values.status,
        ...(values.password ? { passwordHash: await bcrypt.hash(values.password, 10) } : {}),
      },
      select: userSelect,
    });

    return NextResponse.json({ item });
  } catch (error) {
    return systemUserApiError(error, "账号保存失败");
  }
}

export async function PUT(request: NextRequest, context: Context) {
  return PATCH(request, context);
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    if (!canManageAccounts(session.role)) return forbidden("当前角色不能管理账号");

    const { id } = await context.params;
    const userId = numericId(id);
    if (userId === session.userId) return NextResponse.json({ message: "不能删除当前登录账号" }, { status: 400 });

    const item = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id: userId }, select: userSelect });
      if (!existing) throw new Error("账号不存在或已删除");

      await tx.channelDailyMetric.updateMany({ where: { createdBy: userId }, data: { createdBy: null } });
      await tx.channelMetricPeriod.updateMany({ where: { createdBy: userId }, data: { createdBy: null } });
      await tx.metricImportBatch.updateMany({ where: { createdBy: userId }, data: { createdBy: null } });
      await tx.customer.updateMany({ where: { ownerId: userId }, data: { ownerId: null } });
      await tx.customerFollowup.updateMany({ where: { ownerId: userId }, data: { ownerId: null } });
      await tx.order.updateMany({ where: { salespersonId: userId }, data: { salespersonId: null } });
      await tx.order.updateMany({ where: { createdBy: userId }, data: { createdBy: null } });
      await tx.orderStatusLog.updateMany({ where: { createdBy: userId }, data: { createdBy: null } });
      await tx.attachment.updateMany({ where: { uploadedBy: userId }, data: { uploadedBy: null } });
      await tx.user.delete({ where: { id: userId } });

      return existing;
    });

    return NextResponse.json({ item, ok: true });
  } catch (error) {
    return systemUserApiError(error, "账号删除失败");
  }
}
