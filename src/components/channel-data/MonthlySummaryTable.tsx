"use client";

import { Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { channelTypeLabel, currencyMoney, PercentText, RoiTag, rowAdSpend, rowAdSpendBase, rowKey, rowSales, rowSalesBase, safeRatio } from "./channelDataUtils";
import type { ChannelDataRow } from "./channelDataTypes";

type MonthlySummaryTableProps = {
  rows: ChannelDataRow[];
  loading: boolean;
};

export default function MonthlySummaryTable({ rows, loading }: MonthlySummaryTableProps) {
  // 跨渠道汇总/占比统一本位币(base),逐行金额仍按原币显示
  const totalSalesBase = rows.reduce((total, row) => total + rowSalesBase(row), 0);
  const totalAdSpendBase = rows.reduce((total, row) => total + rowAdSpendBase(row), 0);
  const totalMoney = (value: number) => currencyMoney(value, "CNY");

  const columns: ColumnsType<ChannelDataRow> = [
    { title: "业务线", dataIndex: "businessLine", width: 150, render: (value) => <Typography.Text strong>{value}</Typography.Text> },
    { title: "平台", dataIndex: ["platform", "name"], width: 130, render: (value) => value || "-" },
    { title: "店铺/站点", dataIndex: ["store", "name"], width: 180, render: (value) => value || "-" },
    {
      title: "渠道名称",
      dataIndex: "channelName",
      width: 180,
      render: (value, row) => <span>{value} <span className="text-xs text-[var(--muted)]">/ {channelTypeLabel(row.channelType)}</span></span>,
    },
    { title: "月销售", key: "sales", width: 140, align: "right", sorter: (a, b) => rowSalesBase(a) - rowSalesBase(b), render: (_, row) => currencyMoney(rowSales(row), row.currency) },
    { title: "月广告", key: "ad", width: 140, align: "right", sorter: (a, b) => rowAdSpendBase(a) - rowAdSpendBase(b), render: (_, row) => currencyMoney(rowAdSpend(row), row.currency) },
    {
      title: "ROI",
      key: "roi",
      width: 110,
      align: "right",
      sorter: (a, b) => (safeRatio(rowSales(a), rowAdSpend(a)) ?? -1) - (safeRatio(rowSales(b), rowAdSpend(b)) ?? -1),
      render: (_, row) => <RoiTag value={safeRatio(rowSales(row), rowAdSpend(row))} />,
    },
    { title: "广告占比", key: "adRatio", width: 120, align: "right", render: (_, row) => <PercentText value={rowSales(row) > 0 ? rowAdSpend(row) / rowSales(row) : 0} /> },
    { title: "销售占比", key: "salesShare", width: 120, align: "right", render: (_, row) => <PercentText tone="share" value={totalSalesBase > 0 ? rowSalesBase(row) / totalSalesBase : 0} /> },
  ];

  return (
    <Table<ChannelDataRow>
      size="small"
      rowKey={rowKey}
      columns={columns}
      dataSource={rows}
      loading={loading}
      pagination={false}
      scroll={{ x: 1260 }}
      summary={() => (
        <Table.Summary fixed>
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={4}><Typography.Text strong>合计(本位币¥)</Typography.Text></Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right"><Typography.Text strong>{totalMoney(totalSalesBase)}</Typography.Text></Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="right"><Typography.Text strong>{totalMoney(totalAdSpendBase)}</Typography.Text></Table.Summary.Cell>
            <Table.Summary.Cell index={6} align="right"><RoiTag value={safeRatio(totalSalesBase, totalAdSpendBase)} /></Table.Summary.Cell>
            <Table.Summary.Cell index={7} align="right"><PercentText value={totalSalesBase > 0 ? totalAdSpendBase / totalSalesBase : 0} /></Table.Summary.Cell>
            <Table.Summary.Cell index={8} align="right"><PercentText tone="share" value={1} /></Table.Summary.Cell>
          </Table.Summary.Row>
        </Table.Summary>
      )}
    />
  );
}
