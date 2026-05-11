"use client";

import type { ColumnsType } from "antd/es/table";
import { businessLineOptions, channelTypeOptions, optionLabel, statusOptions } from "@/lib/basic-options";
import BasicResourceManager from "./BasicResourceManager";
import { StatusTag } from "./basicUtils";
import type { BasicOptionState, BasicRecord } from "./types";

type ChannelRecord = BasicRecord & {
  businessLine: string;
  channelGroup: string;
  channelName: string;
  channelType: string;
  sortOrder: number;
  brand?: { name: string };
  platform?: { name: string };
  store?: { name: string };
};

export default function ChannelManager({ options }: { options: BasicOptionState }) {
  const columns: ColumnsType<ChannelRecord> = [
    { title: "一级业务线", dataIndex: "businessLine", width: 150 },
    { title: "二级渠道", dataIndex: "channelGroup", width: 150 },
    { title: "三级渠道", dataIndex: "channelName", width: 160 },
    { title: "所属品牌", dataIndex: ["brand", "name"], width: 140, render: (value) => value || "-" },
    { title: "所属平台", dataIndex: ["platform", "name"], width: 140, render: (value) => value || "-" },
    { title: "所属店铺", dataIndex: ["store", "name"], width: 160, render: (value) => value || "-" },
    { title: "渠道类型", dataIndex: "channelType", width: 130, render: (value) => optionLabel(channelTypeOptions, value) },
    { title: "状态", dataIndex: "status", width: 100, render: (value) => <StatusTag status={value} /> },
    { title: "排序", dataIndex: "sortOrder", width: 90 },
  ];

  return (
    <BasicResourceManager<ChannelRecord>
      config={{
        title: "渠道管理",
        description: "维护业务线、渠道层级、渠道类型和所属基础资料。",
        resourcePath: "/api/basic/channels",
        searchPlaceholder: "搜索业务线/渠道名称",
        columns,
        initialValues: { status: "active", sortOrder: 0 },
        extraFilters: [
          { name: "brandId", placeholder: "品牌", options: options.brands },
          { name: "platformId", placeholder: "平台", options: options.platforms },
          { name: "storeId", placeholder: "店铺", options: options.stores },
          { name: "channelType", placeholder: "渠道类型", options: channelTypeOptions },
        ],
        fields: [
          { name: "brandId", label: "所属品牌", type: "select", required: true, options: options.brands },
          { name: "platformId", label: "所属平台", type: "select", required: true, options: options.platforms },
          { name: "storeId", label: "所属店铺/站点", type: "select", options: options.stores },
          { name: "businessLine", label: "一级业务线", type: "select", required: true, options: businessLineOptions },
          { name: "channelGroup", label: "二级渠道", required: true },
          { name: "channelName", label: "三级渠道名称", required: true },
          { name: "channelType", label: "渠道类型", type: "select", required: true, options: channelTypeOptions },
          { name: "sortOrder", label: "排序", type: "number" },
          { name: "status", label: "状态", type: "select", required: true, options: statusOptions },
        ],
      }}
    />
  );
}
