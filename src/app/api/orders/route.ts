import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, buildOrderWhere, nextOrderNo, normalizeOrderInput, orderInclude, parsePositiveInt } from "@/lib/orders";
import { canCreateOrder, forbidden, requireApiSession } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const params = request.nextUrl.searchParams;
    const page = parsePositiveInt(params.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(params.get("pageSize"), 10), 100);
    const where = buildOrderWhere(params, session);
    const [items, total] = await Promise.all([
      prisma.order.findMany({ where, include: orderInclude, orderBy: [{ orderDate: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.order.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    return apiError(error, "订单列表加载失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as Record<string, unknown>;
    const session = await requireApiSession();
    if (!canCreateOrder(session.role)) return forbidden("当前角色不能新增订单");
    const item = await prisma.$transaction(async (tx) => {
      const manualOrderNo = typeof input.orderNo === "string" && input.orderNo.trim() ? input.orderNo.trim() : null;
      const orderNo = manualOrderNo ?? await nextOrderNo(tx);
      const normalized = normalizeOrderInput({ ...input, createdBy: session.userId }, orderNo, session);
      return tx.order.create({
        data: {
          ...normalized.data,
          orderNo,
          items: { create: normalized.items },
          costs: { create: normalized.costs },
          statusLogs: {
            create: {
              fromStatus: null,
              toStatus: String(normalized.data.orderStatus ?? "pending_payment"),
              remark: typeof input.statusRemark === "string" && input.statusRemark.trim() ? input.statusRemark.trim() : "创建订单",
              createdBy: session.userId,
            },
          },
        },
        include: orderInclude,
      });
    });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "订单创建失败");
  }
}
