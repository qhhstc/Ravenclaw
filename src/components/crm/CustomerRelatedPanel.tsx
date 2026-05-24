"use client";

import { Card, Empty, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { StatusTag, formatDate, formatDateTime, moneyText } from "@/components/orders/orderOptions";
import { channelLabel, type CustomerInquiry, type CustomerQuote, type CustomerRecord } from "./crmOptions";

type Props = {
  customer: CustomerRecord;
};

type CustomerOrder = NonNullable<CustomerRecord["orders"]>[number];
type CustomerPayment = NonNullable<CustomerOrder["payments"]>[number] & {
  orderId: number;
  orderNo: string;
};

const inquiryStatusLabels: Record<string, string> = {
  new: "新询盘",
  quoted: "已报价",
  won: "已成交",
  lost: "已丢单",
  closed: "已关闭",
};

const quoteStatusLabels: Record<string, string> = {
  draft: "草稿",
  sent: "已发送",
  accepted: "已接受",
  converted: "已转订单",
  rejected: "已拒绝",
};

const statusColors: Record<string, string> = {
  new: "blue",
  quoted: "purple",
  won: "green",
  lost: "red",
  closed: "default",
  draft: "default",
  sent: "blue",
  accepted: "green",
  converted: "purple",
  rejected: "red",
};

function relatedEmptyText(text: string) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text} />;
}

export default function CustomerRelatedPanel({ customer }: Props) {
  const inquiries = customer.inquiries ?? [];
  const quotes = customer.quotes ?? [];
  const orders = customer.orders ?? [];
  const canViewProfit = orders.some((order) => order.grossProfit !== undefined || order.totalCost !== undefined);
  const canViewPayments = orders.some((order) => Array.isArray(order.payments));
  const payments: CustomerPayment[] = orders.flatMap((order) =>
    (order.payments ?? []).map((payment) => ({
      ...payment,
      orderId: order.id,
      orderNo: order.orderNo,
    })),
  );

  const inquiryColumns: ColumnsType<CustomerInquiry> = [
    { title: "询盘号", dataIndex: "inquiryNo", width: 160, render: (value, row) => <Link className="font-medium" href={`/inquiries/${row.id}`}>{value}</Link> },
    { title: "标题", dataIndex: "title", width: 260, ellipsis: true },
    { title: "状态", dataIndex: "status", width: 110, render: (value: string) => <Tag color={statusColors[value] ?? "default"}>{inquiryStatusLabels[value] ?? value}</Tag> },
    { title: "品牌", dataIndex: ["brand", "name"], width: 130, render: (value) => value || "-" },
    { title: "渠道", dataIndex: "channel", width: 220, ellipsis: true, render: (_, row) => channelLabel(row.channel) },
    { title: "更新时间", dataIndex: "updatedAt", width: 160, render: formatDateTime },
  ];

  const quoteColumns: ColumnsType<CustomerQuote> = [
    { title: "报价单号", dataIndex: "quoteNo", width: 160, render: (value, row) => <Link className="font-medium" href={`/quote-print/${row.id}`}>{value}</Link> },
    { title: "来源询盘", dataIndex: ["inquiry", "inquiryNo"], width: 160, render: (value, row) => row.inquiry ? <Link href={`/inquiries/${row.inquiry.id}`}>{value}</Link> : "-" },
    { title: "状态", dataIndex: "status", width: 110, render: (value: string) => <Tag color={statusColors[value] ?? "default"}>{quoteStatusLabels[value] ?? value}</Tag> },
    { title: "报价金额", dataIndex: "totalAmount", width: 140, align: "right", render: (value, row) => moneyText(value, row.currency) },
    { title: "转订单", dataIndex: ["order", "orderNo"], width: 150, render: (value, row) => row.order ? <Link href={`/orders/${row.order.id}`}>{value}</Link> : "-" },
    { title: "创建时间", dataIndex: "createdAt", width: 160, render: formatDateTime },
  ];

  const orderColumns: ColumnsType<CustomerOrder> = [
    { title: "订单编号", dataIndex: "orderNo", width: 160, render: (value, row) => <Link className="font-medium" href={`/orders/${row.id}`}>{value}</Link> },
    { title: "下单日期", dataIndex: "orderDate", width: 120, render: formatDate },
    { title: "订单状态", dataIndex: "orderStatus", width: 120, render: (value) => <StatusTag type="order" value={value} /> },
    { title: "付款状态", dataIndex: "paymentStatus", width: 120, render: (value) => <StatusTag type="payment" value={value} /> },
    { title: "销售额（订单币种）", dataIndex: "salesAmount", width: 160, align: "right", render: (value, row) => moneyText(value, row.currency) },
    { title: "已收（订单币种）", dataIndex: "paidAmount", width: 160, align: "right", render: (value, row) => moneyText(value, row.currency) },
    { title: "毛利（本位币）", dataIndex: "grossProfit", width: 150, align: "right", render: (value, row) => moneyText(value, row.baseCurrency || "CNY") },
  ];
  if (!canViewProfit) orderColumns.pop();

  const paymentColumns: ColumnsType<CustomerPayment> = [
    { title: "收款日期", dataIndex: "paymentDate", width: 120, render: formatDate },
    { title: "关联订单", dataIndex: "orderNo", width: 160, render: (value, row) => <Link className="font-medium" href={`/orders/${row.orderId}`}>{value}</Link> },
    { title: "金额", dataIndex: "amount", width: 140, align: "right", render: (value, row) => <b className="text-[var(--success)]">{moneyText(value, row.currency)}</b> },
    { title: "方式", dataIndex: "paymentMethod", width: 120, render: (value) => value || "-" },
    { title: "流水/凭证号", dataIndex: "referenceNo", width: 180, ellipsis: true, render: (value) => value || "-" },
    { title: "付款方", dataIndex: "payerName", width: 160, ellipsis: true, render: (value) => value || "-" },
    { title: "登记人", dataIndex: ["creator", "name"], width: 120, render: (value) => value || "-" },
  ];

  return (
    <div className="space-y-4">
      <Card title={`询盘记录（${inquiries.length}）`} styles={{ body: { padding: 0 } }}>
        <Table<CustomerInquiry> rowKey="id" columns={inquiryColumns} dataSource={inquiries} pagination={{ pageSize: 5 }} scroll={{ x: 1040 }} locale={{ emptyText: relatedEmptyText("暂无询盘记录") }} />
      </Card>
      <Card title={`报价记录（${quotes.length}）`} styles={{ body: { padding: 0 } }}>
        <Table<CustomerQuote> rowKey="id" columns={quoteColumns} dataSource={quotes} pagination={{ pageSize: 5 }} scroll={{ x: 1000 }} locale={{ emptyText: relatedEmptyText("暂无报价记录") }} />
      </Card>
      <Card title={`订单记录（${orders.length}）`} styles={{ body: { padding: 0 } }}>
        <Table<CustomerOrder> rowKey="id" columns={orderColumns} dataSource={orders} pagination={{ pageSize: 5 }} scroll={{ x: 960 }} locale={{ emptyText: relatedEmptyText("暂无订单记录") }} />
      </Card>
      {canViewPayments ? (
        <Card title={`收款记录（${payments.length}）`} styles={{ body: { padding: 0 } }}>
          <Table<CustomerPayment> rowKey="id" columns={paymentColumns} dataSource={payments} pagination={{ pageSize: 5 }} scroll={{ x: 1000 }} locale={{ emptyText: relatedEmptyText("暂无收款记录") }} />
        </Card>
      ) : null}
    </div>
  );
}
