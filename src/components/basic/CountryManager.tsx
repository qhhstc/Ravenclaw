"use client";

import type { ColumnsType } from "antd/es/table";
import { statusOptions } from "@/lib/basic-options";
import BasicResourceManager from "./BasicResourceManager";
import { StatusTag } from "./basicUtils";
import type { BasicRecord } from "./types";

type CountryRecord = BasicRecord & {
  name: string;
  code: string;
  region?: string | null;
};

export default function CountryManager() {
  const columns: ColumnsType<CountryRecord> = [
    { title: "国家/地区名称", dataIndex: "name", width: 180 },
    { title: "国家代码", dataIndex: "code", width: 120 },
    { title: "区域", dataIndex: "region", width: 160, render: (value) => value || "-" },
    { title: "状态", dataIndex: "status", width: 100, render: (value) => <StatusTag status={value} /> },
  ];

  return (
    <BasicResourceManager<CountryRecord>
      config={{
        title: "国家/地区",
        description: "维护市场国家、地区代码和区域分类。",
        resourcePath: "/api/basic/countries",
        searchPlaceholder: "搜索国家/代码/区域",
        columns,
        initialValues: { status: "active" },
        fields: [
          { name: "name", label: "国家/地区名称", required: true },
          { name: "code", label: "国家代码", required: true, placeholder: "例如 US、CN、JP" },
          { name: "region", label: "区域", placeholder: "例如 North America、Europe、Asia" },
          { name: "status", label: "状态", type: "select", required: true, options: statusOptions },
        ],
      }}
    />
  );
}
