"use client";

import { Card, Descriptions } from "antd";
import Link from "next/link";
import type { OrderRecord } from "./orderOptions";

export default function OrderSourcePanel({ order }: { order: OrderRecord }) {
  return (
    <Card>
      <Descriptions bordered column={{ xs: 1, md: 2 }}>
        <Descriptions.Item label="来源询盘">
          {order.inquiry ? <Link href={`/inquiries/${order.inquiry.id}`}>{order.inquiry.inquiryNo} · {order.inquiry.title}</Link> : "无"}
        </Descriptions.Item>
        <Descriptions.Item label="来源报价">
          {order.quote ? `${order.quote.quoteNo} · ${order.currency} ${Number(order.quote.totalAmount).toLocaleString("zh-CN")}` : "无"}
        </Descriptions.Item>
        <Descriptions.Item label="来源客户">
          {order.customer ? <Link href={`/crm/customers/${order.customer.id}`}>{order.customer.name}</Link> : "无"}
        </Descriptions.Item>
        <Descriptions.Item label="创建人">{order.creator?.name ?? "-"}</Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
