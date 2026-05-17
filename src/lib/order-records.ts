import { Prisma } from "@prisma/client";
import { decimal } from "@/lib/order-profit-calculations";
import { paymentStatusFor, toNumber } from "@/lib/orders";

export const ACTIVE_PAYMENT_WHERE = { status: { not: "void" } } as const;
export const ACTIVE_SHIPMENT_WHERE = { status: { not: "cancelled" } } as const;

export function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function numberValue(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function positiveMoney(value: unknown, fieldName: string) {
  const amount = Number(numberValue(value));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`${fieldName}必须大于 0`);
  return Number(amount.toFixed(2));
}

export function optionalDate(value: unknown, fallback: Date | null = null) {
  if (!value) return fallback;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? fallback : date;
}

export async function syncOrderPaymentSummary(tx: Prisma.TransactionClient, orderId: number) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { salesAmount: true, totalAmount: true, orderStatus: true },
  });
  if (!order) throw new Error("订单不存在或已被删除");

  const summary = await tx.orderPayment.aggregate({
    where: { orderId, ...ACTIVE_PAYMENT_WHERE },
    _sum: { amount: true },
  });

  const totalAmount = toNumber(order.salesAmount ?? order.totalAmount);
  const paidAmount = Math.min(toNumber(summary._sum.amount), totalAmount);
  const unpaidAmount = Math.max(totalAmount - paidAmount, 0);

  return tx.order.update({
    where: { id: orderId },
    data: {
      paidAmount: decimal(paidAmount),
      unpaidAmount: decimal(unpaidAmount),
      paymentStatus: paymentStatusFor(totalAmount, paidAmount, order.orderStatus),
    },
  });
}

export async function syncOrderShipmentSummary(tx: Prisma.TransactionClient, orderId: number) {
  const shipments = await tx.orderShipment.findMany({
    where: { orderId, ...ACTIVE_SHIPMENT_WHERE },
    orderBy: [{ shipmentDate: "asc" }, { id: "asc" }],
  });

  const firstShipment = shipments[0];
  const latestShipment = shipments[shipments.length - 1];
  const latestFinalShipment = [...shipments].reverse().find((shipment) => shipment.isFinalShipment);

  let shippingStatus = "unshipped";
  if (shipments.length > 0) {
    if (!latestFinalShipment) {
      shippingStatus = "partial_shipped";
    } else if (latestFinalShipment.status === "delivered" || latestFinalShipment.deliveredAt) {
      shippingStatus = "delivered";
    } else {
      shippingStatus = "shipped";
    }
  }

  return tx.order.update({
    where: { id: orderId },
    data: {
      shippingStatus,
      shipmentDate: firstShipment?.shipmentDate ?? null,
      actualShipDate: firstShipment?.shipmentDate ?? null,
      trackingNo: latestShipment?.trackingNo ?? null,
      logisticsProvider: latestShipment?.logisticsProvider ?? null,
    },
  });
}
