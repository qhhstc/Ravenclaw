"use client";

import { Alert, Button, Card, Empty, Space, Statistic, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatDate, moneyText, StatusTag } from "@/components/orders/orderOptions";

type Summary = {
  baseCurrency: string;
  orderCount: number;
  salesAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  totalCost: number;
  grossProfit: number;
  receivableCount: number;
  receivableAmount: number;
  overdueCount: number;
  overdueAmount: number;
  dueTodayCount: number;
  dueTodayAmount: number;
  dueNext7Count: number;
  dueNext7Amount: number;
};

type ReceivableOrder = {
  id: number;
  orderNo: string;
  customerName: string;
  salespersonName: string;
  currency: string;
  salesAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  paymentStatus: string;
  dueDate?: string | null;
  orderDate?: string | null;
};

type ShippingRiskOrder = {
  id: number;
  orderNo: string;
  customerName: string;
  salespersonName: string;
  currency: string;
  salesAmount: number;
  shippingStatus: string;
  expectedShipDate?: string | null;
  orderDate?: string | null;
};

type RecentPayment = {
  id: number;
  orderId: number;
  orderNo: string;
  customerName: string;
  paymentDate?: string | null;
  amount: number;
  currency: string;
  paymentMethod?: string | null;
  referenceNo?: string | null;
  creatorName: string;
};

type Overview = {
  summary: Summary;
  paymentStatusRows: Array<{ paymentStatus: string; count: number; paidAmount: number; unpaidAmount: number }>;
  shippingStatusRows: Array<{ shippingStatus: string; count: number }>;
  receivableOrders: ReceivableOrder[];
  shippingRiskOrders: ShippingRiskOrder[];
  recentPayments: RecentPayment[];
  message?: string;
};

export default function FinanceCenterPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/finance/overview");
      const nextData = (await response.json()) as Overview;
      if (!response.ok) throw new Error(nextData.message || "财务中心数据加载失败");
      setData(nextData);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "财务中心数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(loadData);
  }, [loadData]);

  const receivableColumns: ColumnsType<ReceivableOrder> = [
    { title: "订单号", dataIndex: "orderNo", width: 160, render: (value, row) => <Link href={`/orders/${row.id}`}>{value}</Link> },
    { title: "客户", dataIndex: "customerName", width: 180 },
    { title: "业务员", dataIndex: "salespersonName", width: 110 },
    { title: "到期日", dataIndex: "dueDate", width: 120, render: formatDate },
    { title: "付款状态", dataIndex: "paymentStatus", width: 110, render: (value) => <StatusTag type="payment" value={value} /> },
    { title: "订单金额", dataIndex: "salesAmount", width: 130, align: "right", render: (value, row) => moneyText(value, row.currency) },
    { title: "已收", dataIndex: "paidAmount", width: 130, align: "right", render: (value, row) => moneyText(value, row.currency) },
    { title: "未收", dataIndex: "unpaidAmount", width: 130, align: "right", render: (value, row) => <b className="text-orange-500">{moneyText(value, row.currency)}</b> },
    { title: "操作", width: 100, render: (_value, row) => <Link href={`/orders/${row.id}`}>去登记</Link> },
  ];

  const shippingColumns: ColumnsType<ShippingRiskOrder> = [
    { title: "订单号", dataIndex: "orderNo", width: 160, render: (value, row) => <Link href={`/orders/${row.id}`}>{value}</Link> },
    { title: "客户", dataIndex: "customerName", width: 180 },
    { title: "业务员", dataIndex: "salespersonName", width: 110 },
    { title: "预计发货", dataIndex: "expectedShipDate", width: 120, render: formatDate },
    { title: "发货状态", dataIndex: "shippingStatus", width: 120, render: (value) => <StatusTag type="shipping" value={value} /> },
    { title: "订单金额", dataIndex: "salesAmount", width: 130, align: "right", render: (value, row) => moneyText(value, row.currency) },
    { title: "操作", width: 100, render: (_value, row) => <Link href={`/orders/${row.id}`}>去登记</Link> },
  ];

  const paymentColumns: ColumnsType<RecentPayment> = [
    { title: "收款日期", dataIndex: "paymentDate", width: 120, render: formatDate },
    { title: "订单号", dataIndex: "orderNo", width: 160, render: (value, row) => <Link href={`/orders/${row.orderId}`}>{value}</Link> },
    { title: "客户", dataIndex: "customerName", width: 180 },
    { title: "金额", dataIndex: "amount", width: 140, align: "right", render: (value, row) => <b className="text-[var(--success)]">{moneyText(value, row.currency)}</b> },
    { title: "方式", dataIndex: "paymentMethod", width: 120, render: (value) => value || "-" },
    { title: "流水/凭证号", dataIndex: "referenceNo", width: 180, render: (value) => value || "-" },
    { title: "登记人", dataIndex: "creatorName", width: 100 },
  ];

  const summary = data?.summary;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, overflow: "hidden" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!mb-1 !text-[var(--foreground)]">财务中心</Typography.Title>
          <Typography.Text type="secondary">集中查看应收、逾期、收款登记和发货风险，数据来自订单和收款/发货明细。</Typography.Text>
        </div>
        <Space wrap>
          <Button onClick={loadData} loading={loading}>刷新</Button>
          <Link href="/orders?paymentDue=pending"><Button type="primary">查看待回款订单</Button></Link>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        message="使用方式"
        description="财务在订单详情的“收款记录”里登记每笔到账；业务员在“发货记录”里登记每票发货。系统会自动回写订单的已收、未收和发货状态。"
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 16, alignItems: "stretch" }}>
        <div style={{ minWidth: 0 }}>
          <Card loading={loading}>
            <Statistic title="应收余额" value={summary ? moneyText(summary.receivableAmount, summary.baseCurrency) : "-"} valueStyle={{ color: "var(--warning)" }} />
            <div className="mt-2 text-xs text-[var(--muted)]">{summary?.receivableCount ?? 0} 笔待回款订单</div>
          </Card>
        </div>
        <div style={{ minWidth: 0 }}>
          <Card loading={loading}>
            <Statistic title="逾期应收" value={summary ? moneyText(summary.overdueAmount, summary.baseCurrency) : "-"} valueStyle={{ color: "var(--danger)" }} />
            <div className="mt-2 text-xs text-[var(--muted)]">{summary?.overdueCount ?? 0} 笔已逾期</div>
          </Card>
        </div>
        <div style={{ minWidth: 0 }}>
          <Card loading={loading}>
            <Statistic title="已收金额" value={summary ? moneyText(summary.paidAmount, summary.baseCurrency) : "-"} valueStyle={{ color: "var(--success)" }} />
            <div className="mt-2 text-xs text-[var(--muted)]">未关闭订单累计收款</div>
          </Card>
        </div>
        <div style={{ minWidth: 0 }}>
          <Card loading={loading}>
            <Statistic title="毛利" value={summary ? moneyText(summary.grossProfit, summary.baseCurrency) : "-"} valueStyle={{ color: Number(summary?.grossProfit ?? 0) < 0 ? "var(--danger)" : "var(--chart-blue)" }} />
            <div className="mt-2 text-xs text-[var(--muted)]">{summary?.orderCount ?? 0} 笔未关闭订单</div>
          </Card>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 16, alignItems: "stretch" }}>
        <div style={{ minWidth: 0 }}>
          <Card title="付款状态分布" loading={loading}>
            <Space wrap>
              {data?.paymentStatusRows.length ? (
                data.paymentStatusRows.map((row) => (
                  <Tag key={row.paymentStatus} className="!px-3 !py-2">
                    <StatusTag type="payment" value={row.paymentStatus} /> {row.count} 笔，未收 {moneyText(row.unpaidAmount, data.summary.baseCurrency)}
                  </Tag>
                ))
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无付款数据" />
              )}
            </Space>
          </Card>
        </div>
        <div style={{ minWidth: 0 }}>
          <Card title="发货状态分布" loading={loading}>
            <Space wrap>
              {data?.shippingStatusRows.length ? (
                data.shippingStatusRows.map((row) => (
                  <Tag key={row.shippingStatus} className="!px-3 !py-2">
                    <StatusTag type="shipping" value={row.shippingStatus} /> {row.count} 笔
                  </Tag>
                ))
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无发货数据" />
              )}
            </Space>
          </Card>
        </div>
      </div>

      <Card title="待回款订单" extra={<Link href="/orders?paymentDue=pending">进入订单列表</Link>}>
        <Table rowKey="id" loading={loading} columns={receivableColumns} dataSource={data?.receivableOrders ?? []} pagination={false} scroll={{ x: 1180 }} />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))", gap: 16, alignItems: "stretch" }}>
        <div style={{ minWidth: 0 }}>
          <Card title="待发货/部分发货订单">
            <Table rowKey="id" loading={loading} columns={shippingColumns} dataSource={data?.shippingRiskOrders ?? []} pagination={false} scroll={{ x: 920 }} />
          </Card>
        </div>
        <div style={{ minWidth: 0 }}>
          <Card title="最近收款">
            <Table rowKey="id" loading={loading} columns={paymentColumns} dataSource={data?.recentPayments ?? []} pagination={false} scroll={{ x: 900 }} />
          </Card>
        </div>
      </div>
    </div>
  );
}
