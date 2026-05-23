import dayjs from "dayjs";
import { Tag } from "antd";
import type { OrderPaymentRecord } from "@/components/orders/orderOptions";

export const customerTypeOptions = [
  { label: "个人客户", value: "individual" },
  { label: "公司客户", value: "company" },
  { label: "批发商", value: "wholesaler" },
  { label: "分销商", value: "distributor" },
  { label: "代理商", value: "agent" },
  { label: "红人/达人", value: "influencer" },
  { label: "供应商联系人", value: "supplier_contact" },
  { label: "其他", value: "other" },
];

export const customerStatusOptions = [
  { label: "新客户", value: "new", color: "blue" },
  { label: "已联系", value: "contacted", color: "cyan" },
  { label: "已报价", value: "quoted", color: "purple" },
  { label: "谈判中", value: "negotiating", color: "orange" },
  { label: "已成交", value: "won", color: "green" },
  { label: "复购客户", value: "repeat", color: "green" },
  { label: "已流失", value: "lost", color: "red" },
  { label: "无效客户", value: "invalid", color: "default" },
];

export const customerLevelOptions = [
  { label: "A", value: "A", color: "magenta" },
  { label: "B", value: "B", color: "blue" },
  { label: "C", value: "C", color: "green" },
  { label: "D", value: "D", color: "default" },
];

export const followupStatusOptions = [
  { label: "全部跟进", value: "" },
  { label: "今日待跟进", value: "due" },
  { label: "已逾期", value: "overdue" },
  { label: "未来 7 天", value: "next7days" },
  { label: "无跟进计划", value: "none" },
];

export const followupTypeOptions = [
  { label: "Email", value: "email" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "电话", value: "phone" },
  { label: "微信", value: "wechat" },
  { label: "会议", value: "meeting" },
  { label: "备注", value: "note" },
  { label: "其他", value: "other" },
];

export type Option = { label: string; value: string | number };

export type CrmUser = { id: number; name: string; email?: string; role?: string };
export type CrmBrand = { id: number; name: string; code?: string };
export type CrmCountry = { id: number; name: string; code: string };
export type CrmChannel = {
  id: number;
  businessLine: string;
  channelGroup?: string | null;
  channelName: string;
  channelType?: string;
  store?: { id: number; name: string } | null;
  platform?: { id: number; name: string } | null;
};

export type CustomerRecord = {
  id: number;
  name: string;
  companyName?: string | null;
  customerType: string;
  countryCode?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  sourceChannelId?: number | null;
  brandId?: number | null;
  ownerId?: number | null;
  level: string;
  status: string;
  tags?: string[] | null;
  remark?: string | null;
  lastFollowupAt?: string | null;
  nextFollowupAt?: string | null;
  createdAt: string;
  updatedAt: string;
  brand?: CrmBrand | null;
  sourceChannel?: CrmChannel | null;
  owner?: CrmUser | null;
  contacts?: CustomerContact[];
  followups?: CustomerFollowup[];
  inquiries?: CustomerInquiry[];
  quotes?: CustomerQuote[];
  orders?: Array<{
    id: number;
    orderNo: string;
    orderDate: string;
    currency: string;
    exchangeRate?: number;
    baseCurrency?: string;
    salesAmount: number;
    totalCost: number;
    grossProfit: number;
    grossMargin?: number | null;
    paidAmount: number;
    orderStatus: string;
    paymentStatus: string;
    payments?: OrderPaymentRecord[];
    items?: Array<{
      id?: number;
      sku?: string | null;
      productName: string;
      quantity: number;
      saleUnitPrice: number;
      salesSubtotal?: number;
      purchaseUnitCost: number;
      purchaseCurrency?: string;
      purchaseCostSubtotal?: number;
      purchaseCostBase?: number;
      packagingUnitCost: number;
      packagingCurrency?: string;
      packagingCostSubtotal?: number;
      packagingCostBase?: number;
    }>;
  }>;
};

export type CustomerInquiry = {
  id: number;
  inquiryNo: string;
  title: string;
  status: string;
  countryCode?: string | null;
  createdAt: string;
  updatedAt: string;
  brand?: CrmBrand | null;
  channel?: CrmChannel | null;
};

export type CustomerQuote = {
  id: number;
  quoteNo: string;
  inquiryId?: number | null;
  currency: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  inquiry?: { id: number; inquiryNo: string; title: string; status: string } | null;
  order?: { id: number; orderNo: string } | null;
};

export type CustomerContact = {
  id: number;
  customerId: number;
  name: string;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  isPrimary: boolean;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerFollowup = {
  id: number;
  customerId: number;
  inquiryId?: number | null;
  followupType: string;
  content: string;
  result?: string | null;
  nextFollowupAt?: string | null;
  ownerId?: number | null;
  owner?: CrmUser | null;
  createdAt: string;
  updatedAt: string;
};

export function optionLabel(options: Array<{ label: string; value: string | number }>, value?: string | number | null) {
  return options.find((item) => item.value === value)?.label ?? value ?? "-";
}

export function channelLabel(channel?: CrmChannel | null) {
  if (!channel) return "-";
  return [channel.businessLine, channel.store?.name, channel.channelName].filter(Boolean).join(" / ");
}

export function formatDateTime(value?: string | Date | null) {
  return value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-";
}

export function formatDate(value?: string | Date | null) {
  return value ? dayjs(value).format("YYYY-MM-DD") : "-";
}

export function isOverdue(value?: string | Date | null, status?: string) {
  if (!value || ["won", "lost", "invalid"].includes(status ?? "")) return false;
  return dayjs(value).isBefore(dayjs());
}

export function isToday(value?: string | Date | null) {
  return value ? dayjs(value).isSame(dayjs(), "day") : false;
}

export function LevelTag({ level }: { level?: string | null }) {
  const option = customerLevelOptions.find((item) => item.value === level);
  return <Tag color={option?.color ?? "default"}>{level ?? "-"}</Tag>;
}

export function StatusTag({ status }: { status?: string | null }) {
  const option = customerStatusOptions.find((item) => item.value === status);
  return <Tag color={option?.color ?? "default"}>{option?.label ?? status ?? "-"}</Tag>;
}

export function FollowupTime({ value, status }: { value?: string | null; status?: string }) {
  if (!value) return <span className="text-[var(--muted-weak)]">无计划</span>;
  const color = isOverdue(value, status) ? "text-red-600" : isToday(value) ? "text-orange-500" : "text-[var(--menu-text)]";
  return <span className={color}>{formatDateTime(value)}</span>;
}
