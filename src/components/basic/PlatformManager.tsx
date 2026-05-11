"use client";

import type { ColumnsType } from "antd/es/table";
import { optionLabel, platformTypeOptions, statusOptions } from "@/lib/basic-options";
import BasicResourceManager from "./BasicResourceManager";
import { formatDateTime, StatusTag } from "./basicUtils";
import type { BasicRecord } from "./types";

type PlatformRecord = BasicRecord & {
  name: string;
  code: string;
  type: string;
  updatedAt: string;
};

export default function PlatformManager() {
  const columns: ColumnsType<PlatformRecord> = [
    { title: "平台名称", dataIndex: "name", width: 160 },
    { title: "平台代码", dataIndex: "code", width: 120 },
    { title: "平台类型", dataIndex: "type", width: 150, render: (value) => optionLabel(platformTypeOptions, value) },
    { title: "状态", dataIndex: "status", width: 100, render: (value) => <StatusTag status={value} /> },
    { title: "更新时间", dataIndex: "updatedAt", width: 160, render: formatDateTime },
  ];

  return (
    <BasicResourceManager<PlatformRecord>
      config={{
        title: "平台管理",
        description: "维护 Amazon、Shopify、广告、SEO、EDM 等平台类型。",
        resourcePath: "/api/basic/platforms",
        searchPlaceholder: "搜索平台名称/代码",
        columns,
        initialValues: { status: "active" },
        fields: [
          { name: "name", label: "平台名称", required: true },
          { name: "code", label: "平台代码", required: true },
          { name: "type", label: "平台类型", type: "select", required: true, options: platformTypeOptions },
          { name: "status", label: "状态", type: "select", required: true, options: statusOptions },
        ],
      }}
    />
  );
}
