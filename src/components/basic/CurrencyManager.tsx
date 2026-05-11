"use client";

import type { ColumnsType } from "antd/es/table";
import { statusOptions } from "@/lib/basic-options";
import BasicResourceManager from "./BasicResourceManager";
import { StatusTag } from "./basicUtils";
import type { BasicRecord } from "./types";

type CurrencyRecord = BasicRecord & {
  code: string;
  name: string;
  symbol: string;
};

export default function CurrencyManager() {
  const columns: ColumnsType<CurrencyRecord> = [
    { title: "币种代码", dataIndex: "code", width: 120 },
    { title: "币种名称", dataIndex: "name", width: 180 },
    { title: "符号", dataIndex: "symbol", width: 100 },
    { title: "状态", dataIndex: "status", width: 100, render: (value) => <StatusTag status={value} /> },
  ];

  return (
    <BasicResourceManager<CurrencyRecord>
      config={{
        title: "币种管理",
        description: "维护系统支持的交易币种与展示符号。",
        resourcePath: "/api/basic/currencies",
        searchPlaceholder: "搜索币种代码/名称",
        columns,
        initialValues: { status: "active" },
        fields: [
          { name: "code", label: "币种代码", required: true, placeholder: "例如 USD、CNY、JPY" },
          { name: "name", label: "币种名称", required: true },
          { name: "symbol", label: "符号", required: true, placeholder: "例如 $、¥、€" },
          { name: "status", label: "状态", type: "select", required: true, options: statusOptions },
        ],
      }}
    />
  );
}
