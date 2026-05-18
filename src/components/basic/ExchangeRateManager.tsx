"use client";

import { SyncOutlined } from "@ant-design/icons";
import { Button, Modal, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import BasicResourceManager from "./BasicResourceManager";
import { formatDate, formatDateTime } from "./basicUtils";
import type { BasicOptionState, BasicRecord } from "./types";

type ExchangeRateRecord = BasicRecord & {
  baseCurrency: string;
  targetCurrency: string;
  rate: string | number;
  rateDate: string;
  updatedAt: string;
};

type SyncResult = {
  from: string;
  to: string;
  ok: boolean;
  rate?: number;
  source?: string;
  message?: string;
};

export default function ExchangeRateManager({ options }: { options: BasicOptionState }) {
  const [syncing, setSyncing] = useState(false);

  async function syncExchangeRates(refresh: () => void) {
    setSyncing(true);
    try {
      const response = await fetch("/api/basic/exchange-rates/sync", { method: "POST" });
      const data = (await response.json()) as { updated?: number; failed?: number; results?: SyncResult[]; message?: string };
      if (!response.ok) throw new Error(data.message || "汇率更新失败");
      if ((data.updated ?? 0) > 0) {
        message.success(`汇率更新完成：成功 ${data.updated ?? 0} 条，失败 ${data.failed ?? 0} 条`);
      } else {
        message.warning("暂未获取到外部最新汇率，请检查网络或手动维护汇率");
      }
      Modal.info({
        title: "汇率更新结果",
        width: 720,
        content: (
          <Table<SyncResult>
            className="mt-4"
            size="small"
            rowKey={(row) => `${row.from}-${row.to}`}
            pagination={false}
            dataSource={data.results ?? []}
            columns={[
              { title: "币种对", width: 140, render: (_, row) => `${row.from}/${row.to}` },
              { title: "状态", width: 90, render: (_, row) => (row.ok ? <Tag color="green">成功</Tag> : <Tag color="orange">未更新</Tag>) },
              { title: "汇率", width: 120, align: "right", render: (_, row) => (row.rate ? Number(row.rate).toFixed(6) : "-") },
              { title: "来源/说明", render: (_, row) => row.source || row.message || "-" },
            ]}
          />
        ),
      });
      refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "汇率更新失败");
    } finally {
      setSyncing(false);
    }
  }

  const columns: ColumnsType<ExchangeRateRecord> = [
    { title: "基准币种", dataIndex: "baseCurrency", width: 120 },
    { title: "目标币种", dataIndex: "targetCurrency", width: 120 },
    { title: "汇率", dataIndex: "rate", width: 140, render: (value) => Number(value).toFixed(6) },
    { title: "汇率日期", dataIndex: "rateDate", width: 140, render: formatDate },
    { title: "更新时间", dataIndex: "updatedAt", width: 160, render: formatDateTime },
  ];

  return (
    <BasicResourceManager<ExchangeRateRecord>
      config={{
        title: "汇率管理",
        description: "维护原币种到目标币种的月度或日度汇率。",
        resourcePath: "/api/basic/exchange-rates",
        searchPlaceholder: "搜索币种代码",
        columns,
        fields: [
          { name: "baseCurrency", label: "基准币种", type: "select", required: true, options: options.currencies },
          { name: "targetCurrency", label: "目标币种", type: "select", required: true, options: options.currencies },
          { name: "rate", label: "汇率", required: true },
          { name: "rateDate", label: "汇率日期", type: "date", required: true },
        ],
        extraActions: ({ refresh, loading }) => (
          <Button icon={<SyncOutlined />} loading={syncing} disabled={loading} onClick={() => syncExchangeRates(refresh)}>
            一键更新汇率
          </Button>
        ),
      }}
    />
  );
}
