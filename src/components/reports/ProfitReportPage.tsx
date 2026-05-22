"use client";

import { DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Card, DatePicker, Empty, Select, Space, Statistic, Table, Tabs, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MarginTag, compactMoneyText, formatDate, moneyText, percentText } from "@/components/orders/orderOptions";

type Summary = { orderCount: number; salesAmount: number; totalCost: number; grossProfit: number; grossMargin: number | null };
type RankingRow = Summary & { name: string };
type CostRow = { costType: string; name: string; amount: number; ratio: number | null };
type ProductRow = { sku: string; productName: string; quantity: number; salesAmount: number; purchaseCost: number; packagingCost: number; grossProfit: number; grossMargin: number | null };
type OrderProfitRow = { id: number; orderNo: string; customerName: string; orderDate: string; salesAmount: number; totalCost: number; grossProfit: number; grossMargin: number | null; salespersonName: string; orderStatus: string };
type ReportData = {
  baseCurrency: string;
  summary: Summary;
  daily: RankingRow[];
  weekly: RankingRow[];
  monthly: RankingRow[];
  yearly: RankingRow[];
  costComposition: CostRow[];
  customerRanking: RankingRow[];
  productRanking: ProductRow[];
  orderDetails: OrderProfitRow[];
  message?: string;
};

const emptyReport: ReportData = {
  baseCurrency: "CNY",
  summary: { orderCount: 0, salesAmount: 0, totalCost: 0, grossProfit: 0, grossMargin: null },
  daily: [],
  weekly: [],
  monthly: [],
  yearly: [],
  costComposition: [],
  customerRanking: [],
  productRanking: [],
  orderDetails: [],
};

type Filters = { year: number; month?: number; dateFrom?: string; dateTo?: string };

function query(filters: Filters, extra?: Record<string, string>) {
  const params = new URLSearchParams({ year: String(filters.year) });
  if (filters.month) params.set("month", String(filters.month));
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  Object.entries(extra ?? {}).forEach(([key, value]) => params.set(key, value));
  return params.toString();
}

async function fetchReport(filters: Filters) {
  const response = await fetch(`/api/reports/profit?${query(filters)}`);
  const data = (await response.json()) as ReportData;
  if (!response.ok) throw new Error(data.message || "利润报表加载失败");
  return data;
}

function summaryColumns(baseCurrency: string): ColumnsType<RankingRow> {
  return [
  { title: "周期/客户", dataIndex: "name", width: 180 },
  { title: "订单数", dataIndex: "orderCount", width: 100, align: "right" },
  { title: `销售额（${baseCurrency}）`, dataIndex: "salesAmount", width: 150, align: "right", render: (value) => moneyText(value, baseCurrency) },
  { title: `总成本（${baseCurrency}）`, dataIndex: "totalCost", width: 150, align: "right", render: (value) => moneyText(value, baseCurrency) },
  { title: `毛利（${baseCurrency}）`, dataIndex: "grossProfit", width: 150, align: "right", render: (value) => <span className={Number(value) < 0 ? "font-semibold text-red-500" : ""}>{moneyText(value, baseCurrency)}</span> },
  { title: "毛利率", dataIndex: "grossMargin", width: 110, align: "right", render: (value) => <MarginTag value={value} /> },
  ];
}

function productColumns(baseCurrency: string): ColumnsType<ProductRow> {
  return [
  { title: "SKU", dataIndex: "sku", width: 170 },
  { title: "产品名称", dataIndex: "productName", width: 260 },
  { title: "销售数量", dataIndex: "quantity", width: 100, align: "right" },
  { title: `销售额（${baseCurrency}）`, dataIndex: "salesAmount", width: 150, align: "right", render: (value) => moneyText(value, baseCurrency) },
  { title: `采购成本（${baseCurrency}）`, dataIndex: "purchaseCost", width: 150, align: "right", render: (value) => moneyText(value, baseCurrency) },
  { title: `包装成本（${baseCurrency}）`, dataIndex: "packagingCost", width: 150, align: "right", render: (value) => moneyText(value, baseCurrency) },
  { title: `毛利（${baseCurrency}）`, dataIndex: "grossProfit", width: 150, align: "right", render: (value) => <span className={Number(value) < 0 ? "font-semibold text-red-500" : ""}>{moneyText(value, baseCurrency)}</span> },
  { title: "毛利率", dataIndex: "grossMargin", width: 110, align: "right", render: (value) => <MarginTag value={value} /> },
  ];
}

function costColumns(baseCurrency: string): ColumnsType<CostRow> {
  return [
  { title: "成本类型", dataIndex: "name", width: 220 },
  { title: `金额（${baseCurrency}）`, dataIndex: "amount", width: 160, align: "right", render: (value) => moneyText(value, baseCurrency) },
  { title: "占总成本比例", dataIndex: "ratio", width: 150, align: "right", render: percentText },
  ];
}

function orderColumns(baseCurrency: string): ColumnsType<OrderProfitRow> {
  return [
  { title: "订单编号", dataIndex: "orderNo", width: 160, render: (value, row) => <Link className="font-medium" href={`/orders/${row.id}`}>{value}</Link> },
  { title: "客户名称", dataIndex: "customerName", width: 210 },
  { title: "下单日期", dataIndex: "orderDate", width: 120, render: formatDate },
  { title: `销售额（${baseCurrency}）`, dataIndex: "salesAmount", width: 150, align: "right", render: (value) => moneyText(value, baseCurrency) },
  { title: `总成本（${baseCurrency}）`, dataIndex: "totalCost", width: 150, align: "right", render: (value) => moneyText(value, baseCurrency) },
  { title: `毛利（${baseCurrency}）`, dataIndex: "grossProfit", width: 150, align: "right", render: (value) => <span className={Number(value) < 0 ? "font-semibold text-red-500" : ""}>{moneyText(value, baseCurrency)}</span> },
  { title: "毛利率", dataIndex: "grossMargin", width: 110, align: "right", render: (value) => <MarginTag value={value} /> },
  { title: "业务员", dataIndex: "salespersonName", width: 120 },
  ];
}

export default function ProfitReportPage() {
  const [filters, setFilters] = useState<Filters>({ year: 2026, month: 5 });
  const [loading, setLoading] = useState(false);
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData>(emptyReport);
  const baseCurrency = report.baseCurrency || "CNY";

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await fetchReport(filters));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "利润报表加载失败");
      setReport(emptyReport);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    queueMicrotask(loadReport);
  }, [loadReport]);

  function filenameFromDisposition(disposition: string | null, fallback: string) {
    const utf8Match = disposition?.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
    const fallbackMatch = disposition?.match(/filename="?([^";]+)"?/i);
    return fallbackMatch?.[1] ?? fallback;
  }

  async function exportReport(type: string) {
    setExportingType(type);
    try {
      const response = await fetch(`/api/reports/profit/export?${query(filters, { type })}`);
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "导出失败");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filenameFromDisposition(response.headers.get("Content-Disposition"), "利润报表.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      message.success("利润报表 Excel 已开始下载");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setExportingType(null);
    }
  }

  return (
    <div className="page-stack">
      <div className="page-section-header">
        <div>
          <Typography.Title level={3} className="!mb-1 !text-[var(--foreground)]">利润报表</Typography.Title>
          <Typography.Text type="secondary">按订单、客户与产品汇总外贸业务毛利表现，金额统一换算为本位币 {baseCurrency}。</Typography.Text>
        </div>
        <Space wrap>
          <Button loading={exportingType === "daily"} icon={<DownloadOutlined />} onClick={() => exportReport("daily")}>导出日报</Button>
          <Button loading={exportingType === "weekly"} icon={<DownloadOutlined />} onClick={() => exportReport("weekly")}>导出周报</Button>
          <Button loading={exportingType === "monthly"} icon={<DownloadOutlined />} onClick={() => exportReport("monthly")}>导出月报</Button>
          <Button loading={exportingType === "yearly"} icon={<DownloadOutlined />} onClick={() => exportReport("yearly")}>导出年报</Button>
          <Button loading={exportingType === "costs"} icon={<DownloadOutlined />} onClick={() => exportReport("costs")}>导出成本构成</Button>
          <Button loading={exportingType === "orders"} icon={<DownloadOutlined />} onClick={() => exportReport("orders")}>导出订单利润明细</Button>
          <Button loading={exportingType === "customers"} icon={<DownloadOutlined />} onClick={() => exportReport("customers")}>导出客户排行</Button>
          <Button loading={exportingType === "products"} icon={<DownloadOutlined />} onClick={() => exportReport("products")}>导出产品排行</Button>
        </Space>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Space wrap>
          <Select value={filters.year} style={{ width: 120 }} options={[2025, 2026, 2027].map((value) => ({ label: `${value}年`, value }))} onChange={(year) => setFilters((current) => ({ ...current, year }))} />
          <Select allowClear value={filters.month} style={{ width: 120 }} placeholder="月份" options={Array.from({ length: 12 }, (_, index) => ({ label: `${index + 1}月`, value: index + 1 }))} onChange={(month) => setFilters((current) => ({ ...current, month }))} />
          <DatePicker.RangePicker
            value={filters.dateFrom && filters.dateTo ? [dayjs(filters.dateFrom), dayjs(filters.dateTo)] : null}
            onChange={(values) => setFilters((current) => ({ ...current, dateFrom: values?.[0]?.toISOString(), dateTo: values?.[1]?.endOf("day").toISOString() }))}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => setFilters({ year: 2026, month: 5 })}>重置</Button>
        </Space>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card><Statistic title="总订单数" value={report.summary.orderCount} /></Card>
        <Card><Statistic title={`总销售额（${baseCurrency}）`} value={compactMoneyText(report.summary.salesAmount, baseCurrency)} /></Card>
        <Card><Statistic title={`总成本（${baseCurrency}）`} value={compactMoneyText(report.summary.totalCost, baseCurrency)} /></Card>
        <Card><Statistic title={`总毛利（${baseCurrency}）`} value={compactMoneyText(report.summary.grossProfit, baseCurrency)} valueStyle={{ color: report.summary.grossProfit < 0 ? "#ff4d4f" : "#16a34a" }} /></Card>
        <Card><Statistic title="平均毛利率" value={percentText(report.summary.grossMargin)} /></Card>
      </div>

      <Card styles={{ body: { padding: 0 } }}>
        <Tabs
          tabBarStyle={{ paddingInline: 16, marginBottom: 12 }}
          items={[
            { key: "daily", label: "日报", children: <Table loading={loading} rowKey="name" columns={summaryColumns(baseCurrency)} dataSource={report.daily} pagination={false} locale={{ emptyText: <Empty description="暂无每日利润数据" /> }} /> },
            { key: "weekly", label: "周报", children: <Table loading={loading} rowKey="name" columns={summaryColumns(baseCurrency)} dataSource={report.weekly} pagination={false} locale={{ emptyText: <Empty description="暂无每周利润数据" /> }} /> },
            { key: "monthly", label: "月度统计", children: <Table loading={loading} rowKey="name" columns={summaryColumns(baseCurrency)} dataSource={report.monthly} pagination={false} locale={{ emptyText: <Empty description="暂无月度利润数据" /> }} /> },
            { key: "yearly", label: "年度统计", children: <Table loading={loading} rowKey="name" columns={summaryColumns(baseCurrency)} dataSource={report.yearly} pagination={false} locale={{ emptyText: <Empty description="暂无年度利润数据" /> }} /> },
            { key: "costs", label: "成本构成表", children: <Table loading={loading} rowKey="costType" columns={costColumns(baseCurrency)} dataSource={report.costComposition} pagination={false} scroll={{ x: 620 }} /> },
            { key: "customers", label: "客户利润排行", children: <Table loading={loading} rowKey="name" columns={summaryColumns(baseCurrency)} dataSource={report.customerRanking} pagination={false} scroll={{ x: 850 }} /> },
            { key: "products", label: "产品利润排行", children: <Table loading={loading} rowKey="sku" columns={productColumns(baseCurrency)} dataSource={report.productRanking} pagination={false} scroll={{ x: 1240 }} /> },
            { key: "orders", label: "订单利润明细", children: <Table loading={loading} rowKey="id" columns={orderColumns(baseCurrency)} dataSource={report.orderDetails} pagination={{ pageSize: 10 }} scroll={{ x: 1180 }} /> },
          ]}
        />
      </Card>
    </div>
  );
}
