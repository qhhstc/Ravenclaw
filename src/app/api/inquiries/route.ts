import { NextResponse, type NextRequest } from "next/server";
import { apiError, buildInquiryWhere, inquiryInclude, nextInquiryNo, normalizeInquiryInput, parsePositiveInt } from "@/lib/quotes";
import { prisma } from "@/lib/prisma";
import { canManageSalesFlow, canViewSalesFlow, forbidden, requireApiSession } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canViewSalesFlow(session.role)) return forbidden("当前角色不能查看询盘");
    const params = request.nextUrl.searchParams;
    const page = parsePositiveInt(params.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(params.get("pageSize"), 20), 100);
    const where = buildInquiryWhere(params);
    const [items, total] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        include: inquiryInclude,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.inquiry.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    return apiError(error, "询盘列表加载失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canManageSalesFlow(session.role)) return forbidden("当前角色不能新增询盘");
    const input = (await request.json()) as Record<string, unknown>;
    const inquiryNo = await nextInquiryNo(prisma.inquiry.count);
    const item = await prisma.inquiry.create({
      data: { inquiryNo, ...normalizeInquiryInput(input) },
      include: inquiryInclude,
    });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "询盘创建失败");
  }
}
