import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, parsePositiveInt } from "@/lib/orders";

const quoteInclude = {
  customer: { select: { id: true, name: true, companyName: true } },
  inquiry: { select: { id: true, inquiryNo: true, title: true, status: true } },
  brand: { select: { id: true, name: true } },
  store: { select: { id: true, name: true } },
  order: { select: { id: true, orderNo: true } },
};

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const page = parsePositiveInt(params.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(params.get("pageSize"), 10), 100);
    const keyword = params.get("keyword")?.trim();
    const where = keyword ? {
      OR: [
        { quoteNo: { contains: keyword } },
        { customer: { is: { name: { contains: keyword } } } },
        { customer: { is: { companyName: { contains: keyword } } } },
        { inquiry: { is: { inquiryNo: { contains: keyword } } } },
        { inquiry: { is: { title: { contains: keyword } } } },
      ],
    } : {};
    const [items, total] = await Promise.all([
      prisma.quote.findMany({ where, include: quoteInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.quote.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    return apiError(error, "报价列表加载失败");
  }
}
