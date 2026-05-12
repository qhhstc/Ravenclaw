"use client";

import { Card, Col, Empty, Row, Statistic, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { MarginTag, formatDate, moneyText, type OrderItemRecord } from "@/components/orders/orderOptions";

type CustomerOrder = {
  id: number;
  orderNo: string;
  orderDate: string;
  currency: string;
  salesAmount: number;
  totalCost: number;
  grossProfit: number;
  grossMargin?: number | null;
  paidAmount: number;
  paymentStatus: string;
  items?: OrderItemRecord[];
};

type Props = {
  orders: CustomerOrder[];
};

function numberValue(value: unknown) {
  return Number(value || 0);
}

export default function CustomerTradeAnalysisPanel({ orders }: Props) {
  const totalSales = orders.reduce((sum, order) => sum + numberValue(order.salesAmount), 0);
  const totalProfit = orders.reduce((sum, order) => sum + numberValue(order.grossProfit), 0);
  const margin = totalSales > 0 ? totalProfit / totalSales : null;
  const latestOrderDate = orders[0]?.orderDate;
  const productRows = orders.flatMap((order) =>
    (order.items ?? []).map((item) => ({
      key: `${order.id}-${item.id ?? item.sku}`,
      orderId: order.id,
      orderNo: order.orderNo,
      orderDate: order.orderDate,
      sku: item.sku,
      productName: item.productName,
      quantity: item.quantity,
      saleUnitPrice: item.saleUnitPrice,
      salesSubtotal: item.salesSubtotal,
      purchaseUnitCost: item.purchaseUnitCost,
      packagingUnitCost: item.packagingUnitCost,
    })),
  );

  const orderColumns: ColumnsType<CustomerOrder> = [
    { title: "订单编号", dataIndex: "orderNo", width: 160, render: (value, row) => <Link href={`/orders/${row.id}`}>{value}</Link> },
    { title: "下单日期", dataIndex: "orderDate", width: 120, render: formatDate },
    { title: "销售额", dataIndex: "salesAmount", width: 130, align: "right", render: (value, row) => moneyText(value, row.currency) },
    { title: "总成本", dataIndex: "totalCost", width: 130, align: "right", render: (value, row) => moneyText(value, row.currency) },
    { title: "毛利", dataIndex: "grossProfit", width: 130, align: "right", render: (value, row) => moneyText(value, row.currency) },
    { title: "毛利率", dataIndex: "grossMargin", width: 110, align: "right", render: (value) => <MarginTag value={value} /> },
    { title: "已收金额", dataIndex: "paidAmount", width: 130, align: "right", render: (value, row) => moneyText(value, row.currency) },
    { title: "付款状态", dataIndex: "paymentStatus", width: 120 },
  ];

  const productColumns: ColumnsType<(typeof productRows)[number]> = [
    { title: "订单", dataIndex: "orderNo", width: 150, render: (value, row) => <Link href={`/orders/${row.orderId}`}>{value}</Link> },
    { title: "日期", dataIndex: "orderDate", width: 120, render: formatDate },
    { title: "SKU", dataIndex: "sku", width: 150, render: (value) => value || "-" },
    { title: "产品名称", dataIndex: "productName", width: 260 },
    { title: "数量", dataIndex: "quantity", width: 90, align: "right" },
    { title: "成交单价", dataIndex: "saleUnitPrice", width: 120, align: "right", render: (value) => moneyText(value) },
    { title: "成交金额", dataIndex: "salesSubtotal", width: 130, align: "right", render: (value) => moneyText(value) },
    { title: "采购单价", dataIndex: "purchaseUnitCost", width: 120, align: "right", render: (value) => moneyText(value) },
    { title: "包装单价", dataIndex: "packagingUnitCost", width: 120, align: "right", render: (value) => moneyText(value) },
  ];

  if (!orders.length) return <Empty description="暂无交易记录" />;

  return (
    <div className="space-y-4">
      <Row gutter={[12, 12]}>
        <Col xs={24} md={8} xl={4}><Card><Statistic title="历史订单数" value={orders.length} /></Card></Col>
        <Col xs={24} md={8} xl={5}><Card><Statistic title="总销售额" value={moneyText(totalSales)} /></Card></Col>
        <Col xs={24} md={8} xl={5}><Card><Statistic title="总毛利" value={moneyText(totalProfit)} valueStyle={{ color: totalProfit < 0 ? "#ff4d4f" : "#16a34a" }} /></Card></Col>
        <Col xs={24} md={8} xl={5}><Card><Statistic title="平均毛利率" value={margin == null ? "—" : `${(margin * 100).toFixed(2)}%`} /></Card></Col>
        <Col xs={24} md={8} xl={5}><Card><Statistic title="最近下单日期" value={formatDate(latestOrderDate)} /></Card></Col>
      </Row>
      <Card title="历史订单列表" styles={{ body: { padding: 0 } }}>
        <Table<CustomerOrder> rowKey="id" columns={orderColumns} dataSource={orders} pagination={false} scroll={{ x: 1080 }} />
      </Card>
      <Card title="历史成交产品与价格" styles={{ body: { padding: 0 } }}>
        <Table rowKey="key" columns={productColumns} dataSource={productRows} pagination={{ pageSize: 8 }} scroll={{ x: 1260 }} />
      </Card>
    </div>
  );
}
