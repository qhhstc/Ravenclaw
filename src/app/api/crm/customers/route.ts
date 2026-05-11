import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, buildCustomerWhere, customerInclude, normalizeCustomerInput, parsePositiveInt } from "@/lib/crm";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const page = parsePositiveInt(params.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(params.get("pageSize"), 10), 100);
    const where = buildCustomerWhere(params);
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
    const input = (await request.json()) as Record<string, unknown>;
    const item = await prisma.customer.create({ data: normalizeCustomerInput(input), include: customerInclude });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "客户创建失败");
  }
}
