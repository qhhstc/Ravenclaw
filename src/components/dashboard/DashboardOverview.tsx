"use client";

import { DownloadOutlined, SettingOutlined } from "@ant-design/icons";
import { Button, Card, Col, Progress, Row, Select, Space, Statistic, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { channelShareData, kpiCards, roiRanking, todoCards, trendData, weeklyRows } from "./dashboardData";

const chartColors = ["#1677ff", "#13c2c2", "#52c41a", "#faad14", "#eb2f96"];

type WeeklyRow = (typeof weeklyRows)[number];

const moneyFormatter = (value: number) => `¥${value.toLocaleString("zh-CN")}`;

const columns: ColumnsType<WeeklyRow> = [
  { title: "业务线", dataIndex: "businessLine", fixed: "left", width: 120 },
  { title: "渠道/店铺", dataIndex: "channel", fixed: "left", width: 180 },
  { title: "W1销售", dataIndex: "w1Sales", render: moneyFormatter, width: 120 },
  { title: "W1广告", dataIndex: "w1Ads", render: moneyFormatter, width: 110 },
  { title: "W2销售", dataIndex: "w2Sales", render: moneyFormatter, width: 120 },
  { title: "W2广告", dataIndex: "w2Ads", render: moneyFormatter, width: 110 },
  { title: "W3销售", dataIndex: "w3Sales", render: moneyFormatter, width: 120 },
  { title: "W3广告", dataIndex: "w3Ads", render: moneyFormatter, width: 110 },
  { title: "W4销售", dataIndex: "w4Sales", render: moneyFormatter, width: 120 },
  { title: "W4广告", dataIndex: "w4Ads", render: moneyFormatter, width: 110 },
  { title: "月销售", dataIndex: "monthSales", render: moneyFormatter, width: 130 },
  { title: "月广告", dataIndex: "monthAds", render: moneyFormatter, width: 120 },
  {
    title: "ROI",
    dataIndex: "roi",
    fixed: "right",
    width: 90,
    render: (value: number) => <Tag color={value >= 6 ? "green" : "blue"}>{value.toFixed(2)}</Tag>,
  },
];

export default function DashboardOverview() {
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Space size={12} wrap>
            <Select value="2026年5月" style={{ width: 130 }} options={[{ value: "2026年5月", label: "2026年5月" }]} />
            <Select value="全部品牌" style={{ width: 130 }} options={[{ value: "全部品牌", label: "全部品牌" }]} />
            <Select value="全部平台" style={{ width: 130 }} options={[{ value: "全部平台", label: "全部平台" }]} />
            <Select value="全部店铺" style={{ width: 130 }} options={[{ value: "全部店铺", label: "全部店铺" }]} />
            <Select value="全部国家" style={{ width: 130 }} options={[{ value: "全部国家", label: "全部国家" }]} />
          </Space>
          <Space>
            <Button icon={<DownloadOutlined />}>导出报表</Button>
            <Button type="primary" icon={<SettingOutlined />}>
              自定义看板
            </Button>
          </Space>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        {kpiCards.map((item) => (
          <Col xs={24} sm={12} lg={8} xl={4} key={item.title}>
            <Card>
              <Statistic title={item.title} value={item.value} valueStyle={{ color: "#172033", fontSize: 24 }} />
              <div className="mt-3 text-xs text-[#667085]">
                <Tag color={item.tone === "orange" ? "orange" : "blue"}>{item.change}</Tag>
                较上月/当前状态
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="销售额 vs 广告费趋势">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ left: 12, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#edf0f5" />
                  <XAxis dataKey="week" />
                  <YAxis tickFormatter={(value) => `${Number(value) / 10000}万`} />
                  <Tooltip formatter={(value) => moneyFormatter(Number(value))} />
                  <Legend />
                  <Bar dataKey="adSpend" name="广告费" fill="#91caff" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="sales" name="销售额" stroke="#1677ff" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card title="渠道销售占比">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelShareData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={64}
                    outerRadius={104}
                    paddingAngle={3}
                    label
                  >
                    {channelShareData.map((entry, index) => (
                      <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card title="渠道 ROI 排行">
            <div className="space-y-4">
              {roiRanking.map((item, index) => (
                <div key={item.channel}>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <Space>
                      <Tag color={index < 3 ? "blue" : "default"}>{index + 1}</Tag>
                      <span className="font-medium text-[#172033]">{item.channel}</span>
                    </Space>
                    <span className="text-sm text-[#667085]">{item.sales}</span>
                  </div>
                  <Progress percent={Math.min(item.roi * 10, 100)} showInfo={false} strokeColor="#1677ff" />
                  <div className="mt-1 text-right text-xs text-[#667085]">ROI {item.roi.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={16}>
          <Card title="销售额与广告费对比">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#edf0f5" />
                  <XAxis dataKey="week" />
                  <YAxis tickFormatter={(value) => `${Number(value) / 10000}万`} />
                  <Tooltip formatter={(value) => moneyFormatter(Number(value))} />
                  <Legend />
                  <Bar dataKey="sales" name="销售额" fill="#1677ff" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="adSpend" name="广告费" fill="#13c2c2" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="渠道周报表格">
        <Table columns={columns} dataSource={weeklyRows} pagination={false} scroll={{ x: 1500 }} size="middle" />
      </Card>

      <Row gutter={[16, 16]}>
        {todoCards.map((item) => (
          <Col xs={24} sm={12} xl={6} key={item.title}>
            <Card>
              <Typography.Text type="secondary">{item.title}</Typography.Text>
              <div className="mt-3 text-2xl font-semibold text-[#172033]">{item.value}</div>
              <div className="mt-2 text-sm text-[#667085]">{item.description}</div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
