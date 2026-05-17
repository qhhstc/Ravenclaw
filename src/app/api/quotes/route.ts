import { NextResponse, type NextRequest } from "next/server";
import { apiError, buildQuoteWhere, nextQuoteNo, normalizeQuoteInput, parsePositiveInt, quoteInclude } from "@/lib/quotes";
import { prisma } from "@/lib/prisma";
import { canManageSalesFlow, canViewSalesFlow, forbidden, requireApiSession } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canViewSalesFlow(session.role)) return forbidden("当前角色不能查看报价");
    const params = request.nextUrl.searchParams;
    const page = parsePositiveInt(params.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(params.get("pageSize"), 20), 100);
    const where = buildQuoteWhere(params);
    const [items, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        include: quoteInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.quote.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    return apiError(error, "报价列表加载失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!canManageSalesFlow(session.role)) return forbidden("当前角色不能新增报价");
    const input = (await request.json()) as Record<string, unknown>;
    const quoteNo = await nextQuoteNo(prisma.quote.count);
    const normalized = normalizeQuoteInput(input);
    if (!normalized.items) throw new Error("报价单至少需要 1 行商品明细");
    const quoteItems = normalized.items;

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.quote.create({
        data: {
          quoteNo,
          ...normalized.data,
          items: { create: quoteItems },
        },
        include: quoteInclude,
      });
      if (created.inquiryId) await tx.inquiry.update({ where: { id: created.inquiryId }, data: { status: "quoted" } });
      return created;
    });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "报价创建失败");
  }
}
