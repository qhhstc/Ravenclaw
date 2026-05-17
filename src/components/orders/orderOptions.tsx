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
  { label: "待付款", value: "pending_payment", color: "orange" },
  { label: "已付款", value: "paid", color: "green" },
  { label: "备货中", value: "preparing", color: "cyan" },
  { label: "已发货", value: "shipped", color: "blue" },
  { label: "运输中", value: "in_transit", color: "purple" },
  { label: "清关中", value: "customs_clearance", color: "geekblue" },
  { label: "已签收", value: "delivered", color: "green" },
  { label: "已完成", value: "completed", color: "green" },
  { label: "售后补发", value: "after_sales_reship", color: "volcano" },
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
  { label: "待回款", value: "pending" },
  { label: "已逾期", value: "overdue" },
  { label: "今日到期", value: "today" },
  { label: "未来 7 天", value: "next7days" },
];

export const costTypeOptions = [
  { label: "产品采购成本", value: "product_purchase", readonly: true },
  { label: "国内运费", value: "domestic_shipping" },
  { label: "包装耗材成本", value: "packaging_material", readonly: true },
  { label: "海运 / 空运国际运费", value: "international_shipping" },
  { label: "清关费", value: "customs_fee" },
  { label: "港杂费", value: "port_charge" },
  { label: "拖车费", value: "trucking_fee" },
  { label: "平台手续费", value: "platform_fee" },
  { label: "PayPal / 银行手续费", value: "payment_fee" },
  { label: "其他杂费", value: "other" },
];

export type BasicOption = { id: number; name: string; code?: string };
export type BrandOption = BasicOption;
export type PlatformOption = BasicOption;
export type StoreOption = BasicOption & { brandId?: number; platformId?: number; defaultCurrency?: string; primaryMarketCode?: string | null };
export type CountryOption = { id: number; name: string; code: string };
export type CurrencyOption = { id: number; code: string; name: string; symbol: string };
export type UserOption = { id: number; name: string; email: string; role?: string };

export type ProductOption = {
  id: number;
  sku: string;
  name: string;
  specification?: string | null;
  category?: string | null;
  defaultPurchasePrice: number;
  defaultPackagingCost: number;
  currency: string;
  status: string;
};

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

export type InfluencerOption = {
  id: number;
  influencerName: string;
  platform: string;
  accountHandle?: string | null;
  status: string;
  brandId?: number | null;
  channelId?: number | null;
};

export type OrderItemRecord = {
  id?: number;
  productId?: number | null;
  sku?: string | null;
  productName: string;
  specification?: string | null;
  quantity: number;
  unitPrice?: number;
  costPrice?: number | null;
  totalPrice?: number;
  totalCost?: number;
  saleUnitPrice: number;
  salesSubtotal?: number;
  purchaseUnitCost: number;
  purchaseCostSubtotal?: number;
  packagingUnitCost: number;
  packagingCostSubtotal?: number;
  remark?: string | null;
};

export type OrderCostRecord = {
  id?: number;
  costType: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  baseAmount: number;
  remark?: string | null;
};

export type OrderPaymentRecord = {
  id: number;
  orderId: number;
  paymentDate: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  baseAmount: number;
  paymentMethod?: string | null;
  referenceNo?: string | null;
  payerName?: string | null;
  status: string;
  remark?: string | null;
  createdBy?: number | null;
  createdAt: string;
  updatedAt: string;
  creator?: UserOption | null;
};

export type OrderShipmentRecord = {
  id: number;
  orderId: number;
  shipmentDate: string;
  deliveredAt?: string | null;
  status: string;
  isFinalShipment: boolean;
  logisticsProvider?: string | null;
  trackingNo?: string | null;
  packageCount: number;
  freightAmount: number;
  currency: string;
  exchangeRate: number;
  remark?: string | null;
  createdBy?: number | null;
  createdAt: string;
  updatedAt: string;
  creator?: UserOption | null;
};

export type OrderRecord = {
  id: number;
  orderNo: string;
  externalOrderNo?: string | null;
  orderSource: string;
  customerId?: number | null;
  customerName?: string | null;
  salespersonId?: number | null;
  brandId?: number | null;
  platformId?: number | null;
  storeId?: number | null;
  channelId?: number | null;
  influencerCollaborationId?: number | null;
  countryCode?: string | null;
  currency: string;
  exchangeRate: number;
  baseCurrency: string;
  productAmount: number;
  totalAmount: number;
  salesAmount: number;
  totalCost: number;
  grossProfit: number;
  grossMargin?: number | null;
  paidAmount: number;
  unpaidAmount: number;
  orderStatus: string;
  paymentStatus: string;
  shippingStatus: string;
  orderDate: string;
  shipmentDate?: string | null;
  paymentMethod?: string | null;
  expectedShipDate?: string | null;
  actualShipDate?: string | null;
  dueDate?: string | null;
  trackingNo?: string | null;
  logisticsProvider?: string | null;
  remark?: string | null;
  createdBy?: number | null;
  createdAt: string;
  updatedAt: string;
  customer?: (CustomerOption & { email?: string | null }) | null;
  salesperson?: UserOption | null;
  brand?: BrandOption | null;
  platform?: PlatformOption | null;
  store?: StoreOption | null;
  channel?: ChannelOption | null;
  influencerCollaboration?: Pick<InfluencerOption, "id" | "influencerName" | "platform" | "accountHandle" | "status"> | null;
  quote?: { id: number; quoteNo: string; totalAmount: number; status: string } | null;
  inquiry?: { id: number; inquiryNo: string; title: string; status: string } | null;
  creator?: UserOption | null;
  items?: OrderItemRecord[];
  costs?: OrderCostRecord[];
  payments?: OrderPaymentRecord[];
  shipments?: OrderShipmentRecord[];
  statusLogs?: OrderStatusLogRecord[];
};

export type OrderStatusLogRecord = {
  id: number;
  orderId: number;
  fromStatus?: string | null;
  toStatus: string;
  remark?: string | null;
  createdAt: string;
  creator?: UserOption | null;
};

export function optionLabel(options: Array<{ label: string; value: string }>, value?: string | null) {
  return options.find((item) => item.value === value)?.label ?? value ?? "-";
}

export function optionColor(options: Array<{ color?: string; value: string }>, value?: string | null) {
  return options.find((item) => item.value === value)?.color ?? "default";
}

export function costTypeLabel(value?: string | null) {
  return optionLabel(costTypeOptions, value);
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

export function percentText(value?: number | null) {
  return value === null || value === undefined || !Number.isFinite(Number(value)) ? "—" : `${(Number(value) * 100).toFixed(2)}%`;
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

export function MarginTag({ value }: { value?: number | null }) {
  if (value === null || value === undefined) return <Tag>—</Tag>;
  if (value < 0) return <Tag color="red">{percentText(value)}</Tag>;
  if (value < 0.1) return <Tag color="red">{percentText(value)}</Tag>;
  if (value < 0.2) return <Tag color="orange">{percentText(value)}</Tag>;
  if (value < 0.3) return <Tag color="blue">{percentText(value)}</Tag>;
  return <Tag color="green">{percentText(value)}</Tag>;
}

export function marginColor(value?: number | null, grossProfit?: number | null) {
  if ((grossProfit ?? 0) < 0) return "var(--danger)";
  if (value === null || value === undefined) return "var(--muted)";
  if (value >= 0.3) return "var(--success)";
  if (value >= 0.2) return "var(--chart-blue)";
  if (value >= 0.1) return "var(--warning)";
  return "var(--danger)";
}

export function PaymentDueText({ value, unpaidAmount, orderStatus }: { value?: string | null; unpaidAmount?: number; orderStatus?: string }) {
  const overdue = isOverdue(value, unpaidAmount, orderStatus);
  return <span className={overdue ? "font-medium text-red-500" : undefined}>{formatDate(value)}</span>;
}
