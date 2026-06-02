import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/orders";
import { canEditOrder, canEditOrderPayments, canViewAllOrders, forbidden, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ATTACHMENT_TYPES = new Set(["bill_of_lading", "packing_list", "customs_declaration", "logistics_doc", "payment_proof", "chat_record", "other"]);

type Context = { params: Promise<{ id: string }> };

async function assertOrderAccess(orderId: number, session: Awaited<ReturnType<typeof requireApiSession>>, write = false) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, createdBy: true, salespersonId: true, orderStatus: true } });
  if (!order) throw new Error("订单不存在或已被删除");
  if (write) {
    if (!canEditOrder(session.role, order, session.userId) && !canEditOrderPayments(session.role)) return false;
    return true;
  }
  if (!canViewAllOrders(session.role) && order.createdBy !== session.userId && order.salespersonId !== session.userId) return false;
  return true;
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    const { id } = await context.params;
    const orderId = Number(id);
    if (!(await assertOrderAccess(orderId, session))) return forbidden("只能查看自己负责的订单附件");
    const items = await prisma.attachment.findMany({
      where: { bizType: "order", bizId: orderId },
      include: { uploader: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ items });
  } catch (error) {
    return apiError(error, "附件列表加载失败");
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    const { id } = await context.params;
    const orderId = Number(id);
    if (!(await assertOrderAccess(orderId, session, true))) return forbidden("当前角色不能上传该订单附件");
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("请上传附件文件");
    if (file.size > MAX_FILE_SIZE) throw new Error("附件不能超过 10MB");
    const attachmentTypeValue = String(formData.get("attachmentType") || "other");
    const attachmentType = ATTACHMENT_TYPES.has(attachmentTypeValue) ? attachmentTypeValue : "other";
    const uploadDir = path.join(process.cwd(), "public", "uploads", "orders", String(orderId));
    await mkdir(uploadDir, { recursive: true });
    const safeName = file.name.replace(/[^\w.\-\u4e00-\u9fa5]/g, "_");
    const storedName = `${Date.now()}-${randomUUID()}-${safeName}`;
    const filePath = path.join(uploadDir, storedName);
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
    const item = await prisma.attachment.create({
      data: {
        bizType: "order",
        bizId: orderId,
        fileName: file.name,
        fileUrl: `/uploads/orders/${orderId}/${storedName}`,
        fileType: file.type || null,
        fileSize: file.size,
        attachmentType,
        uploadedBy: session.userId,
      },
      include: { uploader: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "附件上传失败");
  }
}
