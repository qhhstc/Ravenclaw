"use client";

import type { ColumnsType } from "antd/es/table";
import { marketScopeOptions, optionLabel, statusOptions, storeTypeOptions } from "@/lib/basic-options";
import BasicResourceManager from "./BasicResourceManager";
import { StatusTag } from "./basicUtils";
import type { BasicOptionState, BasicRecord } from "./types";

type StoreRecord = BasicRecord & {
  name: string;
  domain?: string | null;
  storeType: string;
  marketScope: string;
  primaryMarketCode?: string | null;
  defaultCurrency: string;
  settlementCurrency?: string | null;
  manager?: string | null;
  remark?: string | null;
  brand?: { name: string };
  platform?: { name: string };
};

export default function StoreManager({ options }: { options: BasicOptionState }) {
  const columns: ColumnsType<StoreRecord> = [
    { title: "店铺/站点名称", dataIndex: "name", width: 180 },
    { title: "所属品牌", dataIndex: ["brand", "name"], width: 140, render: (value) => value || "-" },
    { title: "所属平台", dataIndex: ["platform", "name"], width: 140, render: (value) => value || "-" },
    { title: "站点类型", dataIndex: "storeType", width: 180, render: (value) => optionLabel(storeTypeOptions, value) },
    { title: "市场范围", dataIndex: "marketScope", width: 120, render: (value) => optionLabel(marketScopeOptions, value) },
    { title: "主要市场", dataIndex: "primaryMarketCode", width: 110, render: (value) => value || "-" },
    { title: "默认币种", dataIndex: "defaultCurrency", width: 110 },
    { title: "结算币种", dataIndex: "settlementCurrency", width: 110, render: (value, record) => value || record.defaultCurrency },
    { title: "域名", dataIndex: "domain", width: 180, render: (value) => value || "-" },
    { title: "负责人", dataIndex: "manager", width: 120, render: (value) => value || "-" },
    { title: "状态", dataIndex: "status", width: 100, render: (value) => <StatusTag status={value} /> },
  ];

  return (
    <BasicResourceManager<StoreRecord>
      config={{
        title: "店铺/站点",
        description: "维护店铺、独立站、批发站与内容渠道的基础归属。",
        resourcePath: "/api/basic/stores",
        searchPlaceholder: "搜索店铺/域名/负责人",
        columns,
        initialValues: { status: "active", marketScope: "single_market", defaultCurrency: "USD" },
        fields: [
          { name: "brandId", label: "所属品牌", type: "select", required: true, options: options.brands },
          { name: "platformId", label: "所属平台", type: "select", required: true, options: options.platforms },
          { name: "name", label: "店铺/站点名称", required: true },
          { name: "domain", label: "域名" },
          { name: "storeType", label: "站点类型", type: "select", required: true, options: storeTypeOptions },
          { name: "marketScope", label: "市场范围", type: "select", required: true, options: marketScopeOptions },
          { name: "primaryMarketCode", label: "主要市场", type: "select", options: options.countries },
          { name: "defaultCurrency", label: "默认币种", type: "select", required: true, options: options.currencies },
          { name: "settlementCurrency", label: "结算币种", type: "select", options: options.currencies },
          { name: "manager", label: "负责人" },
          { name: "remark", label: "备注", type: "textarea", span: 2 },
          { name: "status", label: "状态", type: "select", required: true, options: statusOptions },
        ],
      }}
    />
  );
}
