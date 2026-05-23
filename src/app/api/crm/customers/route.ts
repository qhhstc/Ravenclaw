import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, customerInclude, normalizeCustomerInputForSession, parsePositiveInt, scopedCustomerWhere } from "@/lib/crm";
import { canManageCrm, canViewCrm, forbidden, requireApiSession } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canViewCrm(session.role)) return forbidden("当前角色不能查看客户资料");
    const params = request.nextUrl.searchParams;
    const page = parsePositiveInt(params.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(params.get("pageSize"), 10), 20);
    const where = scopedCustomerWhere(params, session);
    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: customerInclude,
        orderBy: [{ nextFollowupAt: "asc" }, { updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.customer.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    return apiError(error, "客户列表加载失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canManageCrm(session.role)) return forbidden("当前角色不能维护客户资料");
    const input = (await request.json()) as Record<string, unknown>;
    const item = await prisma.customer.create({ data: normalizeCustomerInputForSession(input, session), include: customerInclude });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "客户创建失败");
  }
}
