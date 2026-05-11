"use client";

import { Tag } from "antd";
import dayjs from "dayjs";

export const orderSourceOptions = [
  { label: "报价转订单", value: "quote" },
  { label: "WordPress 批发站", value: "wordpress_wholesale" },
  { label: "Shopify 独立站", value: "shopify" },
  { label: "Amazon", value: "amazon" },
  { label: "TikTok Shop", value: "tiktok_shop" },
  { label: "手动订单", value: "manual" },
  { label: "红人合作", value: "influencer" },
  { label: "其他", value: "other" },
];

export const orderStatusOptions = [
  { label: "草稿", value: "draft", color: "default" },
  { label: "待确认", value: "pending_confirm", color: "orange" },
  { label: "已确认", value: "confirmed", color: "blue" },
  { label: "备货中", value: "processing", color: "cyan" },
  { label: "已发货", value: "shipped", color: "purple" },
  { label: "已完成", value: "completed", color: "green" },
  { label: "已取消", value: "cancelled", color: "default" },
  { label: "已退款", value: "refunded", color: "red" },
];

export const paymentStatusOptions = [
  { label: "未付款", value: "unpaid", color: "red" },
  { label: "部分付款", value: "partial_paid", color: "orange" },
  { label: "已付款", value: "paid", color: "green" },
  { label: "已退款", value: "refunded", color: "red" },
];

export const shippingStatusOptions = [
  { label: "未发货", value: "unshipped", color: "default" },
  { label: "部分发货", value: "partial_shipped", color: "orange" },
  { label: "已发货", value: "shipped", color: "blue" },
  { label: "已签收", value: "delivered", color: "green" },
];

export const paymentDueOptions = [
  { label: "全部回款", value: "" },
  { label: "待回款", value: "pending" },
  { label: "已逾期", value: "overdue" },
  { label: "今日到期", value: "today" },
  { label: "未来 7 天", value: "next7days" },
];

export type BasicOption = { id: number; name: string; code?: string };
export type BrandOption = BasicOption;
export type PlatformOption = BasicOption;
export type StoreOption = BasicOption & { brandId?: number; platformId?: number; defaultCurrency?: string; primaryMarketCode?: string | null };
export type CountryOption = { id: number; name: string; code: string };
export type CurrencyOption = { id: number; code: string; name: string; symbol: string };
export type UserOption = { id: number; name: string; email: string };

export type CustomerOption = {
  id: number;
  name: string;
  companyName?: string | null;
  countryCode?: string | null;
  brandId?: number | null;
  sourceChannelId?: number | null;
};

export type ChannelOption = {
  id: number;
  businessLine: string;
  channelGroup?: string | null;
  channelName: string;
  channelType: string;
  brandId?: number | null;
  platformId?: number | null;
  storeId?: number | null;
  store?: { id: number; name: string } | null;
  platform?: { id: number; name: string } | null;
};

export type OrderItemRecord = {
  id?: number;
  sku?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number | null;
  totalPrice?: number;
  totalCost?: number;
  remark?: string | null;
};

export type OrderRecord = {
  id: number;
  orderNo: string;
  externalOrderNo?: string | null;
  orderSource: string;
  customerId?: number | null;
  inquiryId?: number | null;
  quoteId?: number | null;
  brandId?: number | null;
  platformId?: number | null;
  storeId?: number | null;
  channelId?: number | null;
  countryCode?: string | null;
  currency: string;
  productAmount: number;
  shippingFee: number;
  discountAmount: number;
  taxAmount: number;
  otherFee: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  orderStatus: string;
  paymentStatus: string;
  shippingStatus: string;
  orderDate: string;
  expectedShipDate?: string | null;
  actualShipDate?: string | null;
  dueDate?: string | null;
  trackingNo?: string | null;
  logisticsProvider?: string | null;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: (CustomerOption & { email?: string | null }) | null;
  brand?: BrandOption | null;
  platform?: PlatformOption | null;
  store?: StoreOption | null;
  channel?: ChannelOption | null;
  quote?: { id: number; quoteNo: string; totalAmount: number; status: string } | null;
  inquiry?: { id: number; inquiryNo: string; title: string; status: string } | null;
  creator?: UserOption | null;
  items?: OrderItemRecord[];
};

export function optionLabel(options: Array<{ label: string; value: string }>, value?: string | null) {
  return options.find((item) => item.value === value)?.label ?? value ?? "-";
}

export function optionColor(options: Array<{ color?: string; value: string }>, value?: string | null) {
  return options.find((item) => item.value === value)?.color ?? "default";
}

export function channelLabel(channel?: ChannelOption | null) {
  if (!channel) return "-";
  const store = channel.store?.name ? ` / ${channel.store.name}` : "";
  return `${channel.businessLine}${store} / ${channel.channelName}`;
}

export function moneyValue(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return Number((value as { toNumber: () => number }).toNumber()) || 0;
  }
  return Number(value) || 0;
}

export function moneyText(value: unknown, currency = "USD") {
  return `${currency} ${moneyValue(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function compactMoneyText(value: unknown, currency = "USD") {
  return `${currency} ${Math.round(moneyValue(value)).toLocaleString("zh-CN")}`;
}

export function formatDate(value?: string | Date | null) {
  return value ? dayjs(value).format("YYYY-MM-DD") : "-";
}

export function formatDateTime(value?: string | Date | null) {
  return value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-";
}

export function isOverdue(value?: string | Date | null, unpaidAmount?: number, orderStatus?: string) {
  if (!value || !unpaidAmount || ["cancelled", "refunded"].includes(orderStatus ?? "")) return false;
  return dayjs(value).isBefore(dayjs());
}

export function paymentStatusFor(totalAmount: number, paidAmount: number, orderStatus?: string) {
  if (orderStatus === "refunded") return "refunded";
  if (paidAmount <= 0) return "unpaid";
  if (paidAmount < totalAmount) return "partial_paid";
  return "paid";
}

export function StatusTag({ value, type }: { value?: string | null; type: "order" | "payment" | "shipping" }) {
  const options = type === "order" ? orderStatusOptions : type === "payment" ? paymentStatusOptions : shippingStatusOptions;
  return <Tag color={optionColor(options, value)}>{optionLabel(options, value)}</Tag>;
}

export function PaymentDueText({ value, unpaidAmount, orderStatus }: { value?: string | null; unpaidAmount?: number; orderStatus?: string }) {
  const overdue = isOverdue(value, unpaidAmount, orderStatus);
  return <span className={overdue ? "font-medium text-red-500" : undefined}>{formatDate(value)}</span>;
}
