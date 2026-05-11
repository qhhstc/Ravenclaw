"use client";

import { DownloadOutlined, DollarOutlined, SettingOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, DatePicker, Empty, List, Progress, Row, Select, Space, Spin, Statistic, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { todoCards } from "./dashboardData";

type FollowupCustomerData = {
  todayCount: number;
  overdueCount: number;
  next7DaysCount: number;
  items: Array<{
    id: number;
    name: string;
    countryCode?: string | null;
    status: string;
    nextFollowupAt?: string | null;
    owner?: { id: number; name: string; email: string } | null;
    overdue?: boolean;
  }>;
};

const emptyFollowupCustomers: FollowupCustomerData = { todayCount: 0, overdueCount: 0, next7DaysCount: 0, items: [] };

type PendingPaymentData = {
  pendingOrderCount: number;
  pendingAmount: number;
  overdueOrderCount: number;
  items: Array<{
    id: number;
    orderNo: string;
    customerName: string;
    countryCode?: string | null;
    totalAmount: number;
    paidAmount: number;
    unpaidAmount: number;
    dueDate?: string | null;
    paymentStatus: string;
    overdue?: boolean;
  }>;
};

const emptyPendingPayments: PendingPaymentData = { pendingOrderCount: 0, pendingAmount: 0, overdueOrderCount: 0, items: [] };

const customerStatusLabels: Record<string, string> = {
  new: "新客户",
  contacted: "已联系",
  quoted: "已报价",
  negotiating: "谈判中",
  won: "已成交",
  repeat: "复购客户",
  lost: "已流失",
  invalid: "无效客户",
};

const chartColors = ["#1677ff", "#13c2c2", "#52c41a", "#faad14", "#eb2f96", "#722ed1", "#08979c", "#fa541c"];

const defaultFilters = { year: 2026, month: 5 };
const chartInitialDimension = { width: 560, height: 300 };

type DashboardFilters = {
  year: number;
  month: number;
  brandId?: number;
  platformId?: number;
  storeId?: number;
  countryCode?: string;
};

type DashboardOverviewData = {
  kpis: {
    salesAmount: number;
    adSpend: number;
    roi: number | null;
    adSpendRatio: number | null;
    channelCount: number;
    paidChannelCount: number;
  };
  weeklyTrend: Array<{ weekNumber: number; week: string; salesAmount: number; adSpend: number }>;
  businessLineShare: Array<{ name: string; salesAmount: number; ratio: number }>;
  roiRanking: Array<{ rank: number; channelId: number; channelName: string; storeName: string; salesAmount: number; adSpend: number; roi: number | null }>;
  weeklyTable: Array<{
    channelId: number;
    businessLine: string;
    storeName: string;
    channelName: string;
    weeks: Record<string, { salesAmount: number; adSpend: number }>;
    monthSales: number;
    monthAdSpend: number;
    roi: number | null;
  }>;
};

type Option = { label: string; value: string | number };

type OptionRecord = { id: number; name: string; code?: string };

type CountryRecord = { id: number; name: string; code: string };

const emptyOverview: DashboardOverviewData = {
  kpis: { salesAmount: 0, adSpend: 0, roi: null, adSpendRatio: null, channelCount: 0, paidChannelCount: 0 },
  weeklyTrend: [],
  businessLineShare: [],
  roiRanking: [],
  weeklyTable: [],
};

function moneyFormatter(value: number) {
  return `¥${Math.round(value || 0).toLocaleString("zh-CN")}`;
}

function shortMoney(value: number) {
  const numericValue = Number(value || 0);
  if (Math.abs(numericValue) >= 10000) return `${Math.round(numericValue / 10000).toLocaleString("zh-CN")}万`;
  return `${Math.round(numericValue).toLocaleString("zh-CN")}`;
}

function ratioFormatter(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(2);
}

function percentFormatter(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(1)}%`;
}

function formatDateTime(value?: string | Date | null) {
  return value ? dayjs(value).format("MM-DD HH:mm") : "-";
}


function roiColor(value: number | null) {
  if (value === null) return "default";
  if (value >= 5) return "green";
  if (value > 0 && value < 3) return "orange";
  return "blue";
}

function toQuery(filters: DashboardFilters) {
  const params = new URLSearchParams({ year: String(filters.year), month: String(filters.month) });
  Object.entries(filters).forEach(([key, value]) => {
    if (key !== "year" && key !== "month" && value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  return params.toString();
}

function getWeek(row: DashboardOverviewData["weeklyTable"][number], weekNumber: number) {
  return row.weeks[String(weekNumber)] ?? { salesAmount: 0, adSpend: 0 };
}

async function fetchOptions<T>(path: string, mapper: (item: T) => Option) {
  const response = await fetch(`${path}?page=1&pageSize=100&status=active`);
  const data = (await response.json()) as { items?: T[]; message?: string };
  if (!response.ok) throw new Error(data.message || "筛选项加载失败");
  return (data.items ?? []).map(mapper);
}

export default function DashboardOverview() {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [overview, setOverview] = useState<DashboardOverviewData>(emptyOverview);
  const [brandOptions, setBrandOptions] = useState<Option[]>([]);
  const [platformOptions, setPlatformOptions] = useState<Option[]>([]);
  const [storeOptions, setStoreOptions] = useState<Option[]>([]);
  const [countryOptions, setCountryOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [optionLoading, setOptionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followupCustomers, setFollowupCustomers] = useState<FollowupCustomerData>(emptyFollowupCustomers);
  const [followupLoading, setFollowupLoading] = useState(false);
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentData>(emptyPendingPayments);
  const [pendingPaymentsLoading, setPendingPaymentsLoading] = useState(false);

  const columns = useMemo<ColumnsType<DashboardOverviewData["weeklyTable"][number]>>(
    () => [
      { title: "业务线", dataIndex: "businessLine", fixed: "left", width: 130 },
      {
        title: "渠道/店铺",
        key: "channelStore",
        fixed: "left",
        width: 210,
        render: (_, row) => (
          <div>
            <div className="font-medium text-[#172033]">{row.channelName}</div>
            <div className="text-xs text-[#8a94a6]">{row.storeName}</div>
          </div>
        ),
      },
      ...[1, 2, 3, 4, 5].flatMap((weekNumber) => [
        { title: `W${weekNumber}销售`, key: `w${weekNumber}Sales`, width: 116, align: "right" as const, render: (_: unknown, row: DashboardOverviewData["weeklyTable"][number]) => moneyFormatter(getWeek(row, weekNumber).salesAmount) },
        { title: `W${weekNumber}广告`, key: `w${weekNumber}Ad`, width: 116, align: "right" as const, render: (_: unknown, row: DashboardOverviewData["weeklyTable"][number]) => moneyFormatter(getWeek(row, weekNumber).adSpend) },
      ]),
      { title: "月销售", dataIndex: "monthSales", width: 130, align: "right", render: moneyFormatter },
      { title: "月广告", dataIndex: "monthAdSpend", width: 130, align: "right", render: moneyFormatter },
      {
        title: "ROI",
        dataIndex: "roi",
        fixed: "right",
        width: 90,
        align: "right",
        render: (value: number | null) => <Tag color={roiColor(value)}>{ratioFormatter(value)}</Tag>,
      },
    ],
    [],
  );

  const kpiCards = [
    { title: "本月销售额", value: moneyFormatter(overview.kpis.salesAmount), tag: "真实数据", color: "blue" },
    { title: "本月广告费", value: moneyFormatter(overview.kpis.adSpend), tag: "真实数据", color: "cyan" },
    { title: "整体 ROI", value: ratioFormatter(overview.kpis.roi), tag: "真实数据", color: "green" },
    { title: "广告占比", value: percentFormatter(overview.kpis.adSpendRatio), tag: "真实数据", color: "orange" },
    { title: "渠道数量", value: overview.kpis.channelCount, tag: "真实数据", color: "blue" },
    { title: "有广告费渠道数", value: overview.kpis.paidChannelCount, tag: "真实数据", color: "purple" },
    { title: "净利润", value: "待接入", tag: "订单/财务模块", color: "default" },
    { title: "应收账款", value: "待接入", tag: "财务模块", color: "default" },
  ];

  const loadOptions = useCallback(async () => {
    setOptionLoading(true);
    try {
      const [brands, platforms, stores, countries] = await Promise.all([
        fetchOptions<OptionRecord>("/api/basic/brands", (item) => ({ label: item.code ? `${item.name} (${item.code})` : item.name, value: item.id })),
        fetchOptions<OptionRecord>("/api/basic/platforms", (item) => ({ label: item.code ? `${item.name} (${item.code})` : item.name, value: item.id })),
        fetchOptions<OptionRecord>("/api/basic/stores", (item) => ({ label: item.name, value: item.id })),
        fetchOptions<CountryRecord>("/api/basic/countries", (item) => ({ label: `${item.name} (${item.code})`, value: item.code })),
      ]);
      setBrandOptions(brands);
      setPlatformOptions(platforms);
      setStoreOptions(stores);
      setCountryOptions(countries);
    } catch (loadError) {
      message.error(loadError instanceof Error ? loadError.message : "筛选项加载失败");
    } finally {
      setOptionLoading(false);
    }
  }, []);


  const loadFollowupCustomers = useCallback(async () => {
    setFollowupLoading(true);
    try {
      const response = await fetch("/api/dashboard/followup-customers");
      const data = (await response.json()) as FollowupCustomerData & { message?: string };
      if (!response.ok) throw new Error(data.message || "待跟进客户加载失败");
      setFollowupCustomers(data);
    } catch (loadError) {
      message.error(loadError instanceof Error ? loadError.message : "待跟进客户加载失败");
      setFollowupCustomers(emptyFollowupCustomers);
    } finally {
      setFollowupLoading(false);
    }
  }, []);

  const loadPendingPayments = useCallback(async () => {
    setPendingPaymentsLoading(true);
    try {
      const response = await fetch("/api/dashboard/pending-payments");
      const data = (await response.json()) as PendingPaymentData & { message?: string };
      if (!response.ok) throw new Error(data.message || "待回款订单加载失败");
      setPendingPayments(data);
    } catch (loadError) {
      message.error(loadError instanceof Error ? loadError.message : "待回款订单加载失败");
      setPendingPayments(emptyPendingPayments);
    } finally {
      setPendingPaymentsLoading(false);
    }
  }, []);

  const loadOverview = useCallback(async (nextFilters: DashboardFilters) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/dashboard/overview?${toQuery(nextFilters)}`);
      const data = (await response.json()) as DashboardOverviewData & { message?: string };
      if (!response.ok) throw new Error(data.message || "经营看板加载失败");
      setOverview(data);
    } catch (loadError) {
      const messageText = loadError instanceof Error ? loadError.message : "经营看板加载失败";
      setError(messageText);
      message.error(messageText);
      setOverview(emptyOverview);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadOptions();
      void loadFollowupCustomers();
      void loadPendingPayments();
    });
  }, [loadFollowupCustomers, loadOptions, loadPendingPayments]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadOverview(filters);
    });
  }, [filters, loadOverview]);

  function updateFilter(patch: Partial<DashboardFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  return (
    <div className="space-y-5 overflow-hidden">
      <Card styles={{ body: { padding: 16 } }}>
        <Spin spinning={optionLoading}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Space size={12} wrap>
              <DatePicker
                picker="month"
                allowClear={false}
                value={dayjs(`${filters.year}-${String(filters.month).padStart(2, "0")}-01`)}
                format="YYYY年M月"
                style={{ width: 140 }}
                onChange={(value) => {
                  if (value) updateFilter({ year: value.year(), month: value.month() + 1 });
                }}
              />
              <Select allowClear showSearch optionFilterProp="label" placeholder="全部品牌" value={filters.brandId} style={{ width: 160 }} options={brandOptions} onChange={(value) => updateFilter({ brandId: value })} />
              <Select allowClear showSearch optionFilterProp="label" placeholder="全部平台" value={filters.platformId} style={{ width: 160 }} options={platformOptions} onChange={(value) => updateFilter({ platformId: value })} />
              <Select allowClear showSearch optionFilterProp="label" placeholder="全部店铺" value={filters.storeId} style={{ width: 180 }} options={storeOptions} onChange={(value) => updateFilter({ storeId: value })} />
              <Select allowClear showSearch optionFilterProp="label" placeholder="全部国家" value={filters.countryCode} style={{ width: 160 }} options={countryOptions} onChange={(value) => updateFilter({ countryCode: value })} />
            </Space>
            <Space>
              <Button icon={<DownloadOutlined />} disabled>导出报表</Button>
              <Button type="primary" icon={<SettingOutlined />} disabled>
                自定义看板
              </Button>
            </Space>
          </div>
        </Spin>
      </Card>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <Spin spinning={loading}>
        <Row gutter={[12, 12]}>
          {kpiCards.map((item) => (
            <Col xs={24} sm={12} lg={8} xl={6} xxl={3} key={item.title}>
              <Card styles={{ body: { padding: 16 } }}>
                <Statistic title={item.title} value={item.value} styles={{ content: { color: "#172033", fontSize: 22 } }} />
                <div className="mt-3 text-xs text-[#667085]">
                  <Tag color={item.color}>{item.tag}</Tag>
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]} className="mt-4">
          <Col xs={24} xl={14}>
            <Card title="销售额 vs 广告费趋势">
              {overview.weeklyTrend.some((item) => item.salesAmount > 0 || item.adSpend > 0) ? (
                <div className="h-[300px] min-h-[300px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} initialDimension={chartInitialDimension}>
                    <ComposedChart data={overview.weeklyTrend} margin={{ left: 12, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#edf0f5" />
                      <XAxis dataKey="week" />
                      <YAxis tickFormatter={(value) => shortMoney(Number(value))} />
                      <Tooltip formatter={(value) => moneyFormatter(Number(value))} />
                      <Legend />
                      <Bar dataKey="adSpend" name="广告费" fill="#91caff" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="salesAmount" name="销售额" stroke="#1677ff" strokeWidth={3} dot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : <Empty description="暂无趋势数据" />}
            </Card>
          </Col>

          <Col xs={24} xl={10}>
            <Card title="渠道销售占比">
              {overview.businessLineShare.length ? (
                <div className="h-[300px] min-h-[300px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} initialDimension={chartInitialDimension}>
                    <PieChart>
                      <Pie
                        data={overview.businessLineShare}
                        dataKey="salesAmount"
                        nameKey="name"
                        innerRadius={64}
                        outerRadius={104}
                        paddingAngle={3}
                        label={(item: unknown) => {
                          const entry = item as { name?: string; ratio?: number };
                          return `${entry.name ?? ""} ${percentFormatter(entry.ratio ?? null)}`;
                        }}
                      >
                        {overview.businessLineShare.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value) => moneyFormatter(Number(value))} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <Empty description="暂无占比数据" />}
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} className="mt-4">
          <Col xs={24} xl={8}>
            <Card title="渠道 ROI 排行">
              {overview.roiRanking.length ? (
                <div className="space-y-4">
                  {overview.roiRanking.map((item) => (
                    <div key={item.channelId}>
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <Space>
                          <Tag color={item.rank <= 3 ? "blue" : "default"}>{item.rank}</Tag>
                          <span className="font-medium text-[#172033]">{item.channelName}</span>
                        </Space>
                        <span className="text-sm text-[#667085]">{item.storeName}</span>
                      </div>
                      <Progress percent={Math.min((item.roi ?? 0) * 10, 100)} showInfo={false} strokeColor="#1677ff" />
                      <div className="mt-1 flex justify-between text-xs text-[#667085]">
                        <span>{moneyFormatter(item.salesAmount)} / 广告 {moneyFormatter(item.adSpend)}</span>
                        <span>ROI {ratioFormatter(item.roi)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <Empty description="暂无有广告费渠道" />}
            </Card>
          </Col>

          <Col xs={24} xl={16}>
            <Card title="销售额与广告费对比">
              {overview.weeklyTrend.some((item) => item.salesAmount > 0 || item.adSpend > 0) ? (
                <div className="h-[300px] min-h-[300px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} initialDimension={chartInitialDimension}>
                    <BarChart data={overview.weeklyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#edf0f5" />
                      <XAxis dataKey="week" />
                      <YAxis tickFormatter={(value) => shortMoney(Number(value))} />
                      <Tooltip formatter={(value) => moneyFormatter(Number(value))} />
                      <Legend />
                      <Bar dataKey="salesAmount" name="销售额" fill="#1677ff" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="adSpend" name="广告费" fill="#13c2c2" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <Empty description="暂无对比数据" />}
            </Card>
          </Col>
        </Row>

        <Card
          className="mt-4"
          title="渠道周报表格"
          extra={<Link href="/channel-data">查看全部</Link>}
        >
          <Table columns={columns} dataSource={overview.weeklyTable} rowKey={(row) => String(row.channelId)} pagination={false} scroll={{ x: 1650 }} size="middle" locale={{ emptyText: <Empty description="暂无周报数据" /> }} />
        </Card>
      </Spin>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Typography.Text type="secondary">近期询盘</Typography.Text>
            <div className="mt-3 text-2xl font-semibold text-[#172033]">待接入</div>
            <div className="mt-2 text-sm text-[#667085]">询盘报价模块上线后接入</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card
            title={<Typography.Text type="secondary">待跟进客户</Typography.Text>}
            extra={<Link href="/crm/customers?followupStatus=due">查看全部</Link>}
            styles={{ body: { paddingTop: 8 } }}
          >
            <Spin spinning={followupLoading}>
              <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-[#fff7e6] p-2">
                  <div className="text-lg font-semibold text-orange-500">{followupCustomers.todayCount}</div>
                  <div className="text-xs text-[#667085]">今日</div>
                </div>
                <div className="rounded-lg bg-[#fff1f0] p-2">
                  <div className="text-lg font-semibold text-red-500">{followupCustomers.overdueCount}</div>
                  <div className="text-xs text-[#667085]">逾期</div>
                </div>
                <div className="rounded-lg bg-[#e6f4ff] p-2">
                  <div className="text-lg font-semibold text-[#1677ff]">{followupCustomers.next7DaysCount}</div>
                  <div className="text-xs text-[#667085]">7天</div>
                </div>
              </div>
              {followupCustomers.items.length ? (
                <List
                  size="small"
                  dataSource={followupCustomers.items}
                  renderItem={(item) => (
                    <List.Item className="!px-0">
                      <List.Item.Meta
                        avatar={<UserOutlined className={item.overdue ? "text-red-500" : "text-[#1677ff]"} />}
                        title={<Link href={`/crm/customers/${item.id}`}>{item.name}</Link>}
                        description={`${item.countryCode ?? "-"} · ${customerStatusLabels[item.status] ?? item.status} · ${item.owner?.name ?? "-"}`}
                      />
                      <span className={item.overdue ? "text-xs text-red-500" : "text-xs text-[#667085]"}>{formatDateTime(item.nextFollowupAt)}</span>
                    </List.Item>
                  )}
                />
              ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待跟进客户" />}
            </Spin>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card
            title={<Typography.Text type="secondary">待回款订单</Typography.Text>}
            extra={<Link href="/orders?paymentDue=pending">查看全部</Link>}
            styles={{ body: { paddingTop: 8 } }}
          >
            <Spin spinning={pendingPaymentsLoading}>
              <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-[#fff7e6] p-2">
                  <div className="text-lg font-semibold text-orange-500">{pendingPayments.pendingOrderCount}</div>
                  <div className="text-xs text-[#667085]">待回款</div>
                </div>
                <div className="rounded-lg bg-[#fff1f0] p-2">
                  <div className="text-lg font-semibold text-red-500">{pendingPayments.overdueOrderCount}</div>
                  <div className="text-xs text-[#667085]">逾期</div>
                </div>
                <div className="rounded-lg bg-[#e6f4ff] p-2">
                  <div className="text-lg font-semibold text-[#1677ff]">{shortMoney(pendingPayments.pendingAmount)}</div>
                  <div className="text-xs text-[#667085]">未收金额</div>
                </div>
              </div>
              {pendingPayments.items.length ? (
                <List
                  size="small"
                  dataSource={pendingPayments.items}
                  renderItem={(item) => (
                    <List.Item className="!px-0">
                      <List.Item.Meta
                        avatar={<DollarOutlined className={item.overdue ? "text-red-500" : "text-[#1677ff]"} />}
                        title={<Link href={`/orders/${item.id}`}>{item.orderNo}</Link>}
                        description={`${item.customerName} · ${item.countryCode ?? "-"} · 未收 ${moneyFormatter(item.unpaidAmount)}`}
                      />
                      <span className={item.overdue ? "text-xs text-red-500" : "text-xs text-[#667085]"}>{formatDateTime(item.dueDate)}</span>
                    </List.Item>
                  )}
                />
              ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待回款订单" />}
            </Spin>
          </Card>
        </Col>
        {todoCards.filter((item) => !["近期询盘", "待跟进客户", "待回款订单"].includes(item.title)).map((item) => (
          <Col xs={24} sm={12} xl={6} key={item.title}>
            <Card>
              <Typography.Text type="secondary">{item.title}</Typography.Text>
              <div className="mt-3 text-2xl font-semibold text-[#172033]">待接入</div>
              <div className="mt-2 text-sm text-[#667085]">{item.description}</div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
