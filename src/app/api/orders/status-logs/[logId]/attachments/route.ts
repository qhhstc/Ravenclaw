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

type Context = { params: Promise<{ logId: string }> };

async function getLogWithOrder(logId: number) {
  return prisma.orderStatusLog.findUnique({
    where: { id: logId },
    include: {
      order: { select: { id: true, createdBy: true, salespersonId: true, orderStatus: true } },
    },
  });
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    const { logId } = await context.params;
    const numericLogId = Number(logId);
    const log = await getLogWithOrder(numericLogId);
    if (!log) return NextResponse.json({ message: "状态记录不存在或已删除" }, { status: 404 });
    if (!canViewAllOrders(session.role) && log.order.createdBy !== session.userId && log.order.salespersonId !== session.userId) return forbidden("只能查看自己负责订单的状态附件");
    const items = await prisma.attachment.findMany({
      where: { bizType: "order_status_log", bizId: numericLogId },
      include: { uploader: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ items });
  } catch (error) {
    return apiError(error, "状态附件加载失败");
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const session = await requireApiSession();
    const { logId } = await context.params;
    const numericLogId = Number(logId);
    const log = await getLogWithOrder(numericLogId);
    if (!log) return NextResponse.json({ message: "状态记录不存在或已删除" }, { status: 404 });
    if (!canEditOrder(session.role, log.order, session.userId) && !canEditOrderPayments(session.role)) return forbidden("当前角色不能上传该状态附件");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("请上传附件文件");
    if (file.size > MAX_FILE_SIZE) throw new Error("附件不能超过 10MB");
    const attachmentTypeValue = String(formData.get("attachmentType") || "other");
    const attachmentType = ATTACHMENT_TYPES.has(attachmentTypeValue) ? attachmentTypeValue : "other";
    const uploadDir = path.join(process.cwd(), "public", "uploads", "order-status-logs", String(numericLogId));
    await mkdir(uploadDir, { recursive: true });
    const safeName = file.name.replace(/[^\w.\-\u4e00-\u9fa5]/g, "_");
    const storedName = `${Date.now()}-${randomUUID()}-${safeName}`;
    const filePath = path.join(uploadDir, storedName);
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
    const item = await prisma.attachment.create({
      data: {
        bizType: "order_status_log",
        bizId: numericLogId,
        fileName: file.name,
        fileUrl: `/uploads/order-status-logs/${numericLogId}/${storedName}`,
        fileType: file.type || null,
        fileSize: file.size,
        attachmentType,
        uploadedBy: session.userId,
      },
      include: { uploader: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "状态附件上传失败");
  }
}
