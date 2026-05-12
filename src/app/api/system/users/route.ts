import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { buildUserWhere, normalizeUserInput, parsePositiveInt, systemUserApiError, userSelect } from "@/lib/system-users";
import { canManageAccounts, forbidden, requireApiSession } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canManageAccounts(session.role)) return forbidden("当前角色不能管理账号");

    const params = request.nextUrl.searchParams;
    const page = parsePositiveInt(params.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(params.get("pageSize"), 10), 100);
    const where = buildUserWhere(params);
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    return systemUserApiError(error, "账号列表加载失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canManageAccounts(session.role)) return forbidden("当前角色不能管理账号");

    const input = (await request.json()) as Record<string, unknown>;
    const values = normalizeUserInput(input, { requirePassword: true });
    const item = await prisma.user.create({
      data: {
        name: values.name,
        email: values.email,
        role: values.role,
        status: values.status,
        passwordHash: await bcrypt.hash(values.password, 10),
      },
      select: userSelect,
    });

    return NextResponse.json({ item });
  } catch (error) {
    return systemUserApiError(error, "账号创建失败");
  }
}
