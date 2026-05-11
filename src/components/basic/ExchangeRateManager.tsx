"use client";

import type { ColumnsType } from "antd/es/table";
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

export default function ExchangeRateManager({ options }: { options: BasicOptionState }) {
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
      }}
    />
  );
}
