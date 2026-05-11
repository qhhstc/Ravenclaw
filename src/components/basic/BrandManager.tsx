"use client";

import type { ColumnsType } from "antd/es/table";
import BasicResourceManager from "./BasicResourceManager";
import { formatDateTime, StatusTag } from "./basicUtils";
import type { BasicOptionState, BasicRecord } from "./types";

type BrandRecord = BasicRecord & {
  name: string;
  code: string;
  website?: string | null;
  defaultCurrency: string;
  description?: string | null;
  updatedAt: string;
};

export default function BrandManager({ options }: { options: BasicOptionState }) {
  const columns: ColumnsType<BrandRecord> = [
    { title: "品牌名称", dataIndex: "name", width: 160 },
    { title: "品牌简称", dataIndex: "code", width: 120 },
    { title: "官网", dataIndex: "website", width: 220, render: (value?: string) => value || "-" },
    { title: "默认币种", dataIndex: "defaultCurrency", width: 120 },
    { title: "状态", dataIndex: "status", width: 100, render: (value) => <StatusTag status={value} /> },
    { title: "更新时间", dataIndex: "updatedAt", width: 160, render: formatDateTime },
  ];

  return (
    <BasicResourceManager<BrandRecord>
      config={{
        title: "品牌管理",
        description: "维护公司经营品牌、官网和默认结算币种。",
        resourcePath: "/api/basic/brands",
        searchPlaceholder: "搜索品牌名称/简称",
        columns,
        initialValues: { status: "active", defaultCurrency: "CNY" },
        fields: [
          { name: "name", label: "品牌名称", required: true },
          { name: "code", label: "品牌简称", required: true },
          { name: "website", label: "官网" },
          { name: "defaultCurrency", label: "默认币种", type: "select", required: true, options: options.currencies },
          { name: "status", label: "状态", type: "select", required: true, options: [
            { label: "启用", value: "active" },
            { label: "停用", value: "inactive" },
          ] },
          { name: "description", label: "描述", type: "textarea", span: 2 },
        ],
      }}
    />
  );
}
