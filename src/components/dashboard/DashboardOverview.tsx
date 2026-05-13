"use client";

import { DownloadOutlined, DollarOutlined, ReloadOutlined, RobotOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, DatePicker, Empty, List, Progress, Row, Select, Space, Spin, Statistic, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { todoCards } from "./dashboardData";

const TrendComposedChart = dynamic(() => import("./DashboardCharts").then((module) => module.TrendComposedChart), { ssr: false, loading: () => <div className="h-[300px] rounded-lg bg-[#f5f7fb]" /> });
const BusinessLinePieChart = dynamic(() => import("./DashboardCharts").then((module) => module.BusinessLinePieChart), { ssr: false, loading: () => <div className="h-[300px] rounded-lg bg-[#f5f7fb]" /> });
const TrendBarChart = dynamic(() => import("./DashboardCharts").then((module) => module.TrendBarChart), { ssr: false, loading: () => <div className="h-[300px] rounded-lg bg-[#f5f7fb]" /> });

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

const defaultFilters = { year: 2026, month: 5, quarter: 2 };

type DashboardFilters = {
  year: number;
  month: number;
  quarter?: number;
  brandId?: number;
  platformId?: number;
  storeId?: number;
  countryCode?: string;
  currency?: string;
};

type DashboardOverviewData = {
  message?: string;
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

type BusinessBlocksData = {
  message?: string;
  visibility: {
    role: string;
    scope: string;
    canViewGlobal: boolean;
    canViewProfit: boolean;
    canViewBudget: boolean;
    canEditDecisions: boolean;
  };
  totals: {
    salesAmount: number;
    adSpend: number;
    productCost: number;
    otherCost: number;
    grossProfit: number;
    grossMargin: number | null;
    roi: number | null;
  } | null;
  blockPerformance: Array<{
    businessBlock: string;
    blockName: string;
    salesAmount: number;
    salesShare: number | null;
    adSpend: number;
    productCost: number;
    otherCost: number;
    grossProfit: number;
    grossMargin: number | null;
    roi: number | null;
    monthOverMonth: number | null;
    rating: { label: string; source: string };
    keyAction: string;
    aiAnalysisStatus: string;
  }>;
  warnings: Array<{
    businessBlock: string;
    blockName: string;
    channelId: number;
    channelName: string;
    warningType: string;
    currentValue: number;
    monthOverMonth: number | null;
    suggestedAction: string;
    decisionOwner: string;
    decisionDeadline?: string | null;
    warningLevel: string;
    remark?: string | null;
  }>;
  budgetSuggestions: Array<{
    businessBlock: string;
    blockName: string;
    currentAdSpend: number;
    nextBudget: number | null;
    adjustAmount: number | null;
    adjustRatio: number | null;
    adjustReason: string;
  }>;
  fieldDefinitions: Array<{ field: string; description: string }>;
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

const emptyBusinessBlocks: BusinessBlocksData = {
  visibility: { role: "viewer", scope: "limited", canViewGlobal: false, canViewProfit: false, canViewBudget: false, canEditDecisions: false },
  totals: null,
  blockPerformance: [],
  warnings: [],
  budgetSuggestions: [],
  fieldDefinitions: [],
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

function rateColor(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "default";
  if (value >= 0.3) return "green";
  if (value >= 0.2) return "blue";
  if (value >= 0.1) return "orange";
  return "red";
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
  const [businessBlocks, setBusinessBlocks] = useState<BusinessBlocksData>(emptyBusinessBlocks);
  const [businessBlocksLoading, setBusinessBlocksLoading] = useState(false);

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

  const blockColumns = useMemo<ColumnsType<BusinessBlocksData["blockPerformance"][number]>>(
    () => [
      { title: "板块", dataIndex: "blockName", fixed: "left", width: 120, render: (value) => <Typography.Text strong>{value}</Typography.Text> },
      { title: "销售额", dataIndex: "salesAmount", width: 130, align: "right", render: moneyFormatter },
      { title: "销售占比", dataIndex: "salesShare", width: 110, align: "right", render: percentFormatter },
      { title: "广告投入", dataIndex: "adSpend", width: 130, align: "right", render: moneyFormatter },
      {
        title: "经营毛利",
        dataIndex: "grossProfit",
        width: 130,
        align: "right",
        render: (value: number) => <span className={value < 0 ? "font-semibold text-red-500" : "font-semibold text-[#172033]"}>{moneyFormatter(value)}</span>,
      },
      { title: "毛利率", dataIndex: "grossMargin", width: 100, align: "right", render: (value: number | null) => <Tag color={rateColor(value)}>{percentFormatter(value)}</Tag> },
      { title: "ROI", dataIndex: "roi", width: 90, align: "right", render: (value: number | null) => <Tag color={roiColor(value)}>{ratioFormatter(value)}</Tag> },
      { title: "环比上月", dataIndex: "monthOverMonth", width: 110, align: "right", render: (value: number | null) => <Tag color={value === null ? "default" : value >= 0 ? "green" : "red"}>{percentFormatter(value)}</Tag> },
      { title: "评级", dataIndex: "rating", width: 120, render: (value: BusinessBlocksData["blockPerformance"][number]["rating"]) => <Tag color={value.source === "none" ? "default" : "purple"}>{value.label}</Tag> },
      { title: "关键动作", dataIndex: "keyAction", width: 240, render: (value: string) => value || "待填写 / 待 AI 分析" },
    ],
    [],
  );

  const warningColumns = useMemo<ColumnsType<BusinessBlocksData["warnings"][number]>>(
    () => [
      { title: "板块", dataIndex: "blockName", width: 110 },
      { title: "渠道", dataIndex: "channelName", width: 150 },
      { title: "异常类型", dataIndex: "warningType", width: 150 },
      { title: "本月数据", dataIndex: "currentValue", width: 130, align: "right", render: moneyFormatter },
      { title: "环比", dataIndex: "monthOverMonth", width: 100, align: "right", render: percentFormatter },
      { title: "建议动作", dataIndex: "suggestedAction", width: 240 },
      { title: "负责人", dataIndex: "decisionOwner", width: 120 },
      { title: "决策 deadline", dataIndex: "decisionDeadline", width: 140, render: (value?: string | null) => (value ? dayjs(value).format("YYYY-MM-DD") : "-") },
      { title: "预警等级", dataIndex: "warningLevel", width: 100, render: (value: string) => <Tag color={value === "red" ? "red" : value === "yellow" ? "orange" : "blue"}>{value || "info"}</Tag> },
      { title: "备注", dataIndex: "remark", width: 180, render: (value) => value || "-" },
    ],
    [],
  );

  const budgetColumns = useMemo<ColumnsType<BusinessBlocksData["budgetSuggestions"][number]>>(
    () => [
      { title: "板块", dataIndex: "blockName", width: 120 },
      { title: "本月广告", dataIndex: "currentAdSpend", width: 130, align: "right", render: moneyFormatter },
      { title: "下月建议预算", dataIndex: "nextBudget", width: 150, align: "right", render: (value: number | null) => (value === null ? "待填写" : moneyFormatter(value)) },
      { title: "调整额", dataIndex: "adjustAmount", width: 130, align: "right", render: (value: number | null) => (value === null ? "—" : moneyFormatter(value)) },
      { title: "调整比例", dataIndex: "adjustRatio", width: 110, align: "right", render: percentFormatter },
      { title: "调整逻辑", dataIndex: "adjustReason", width: 260 },
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

  const loadBusinessBlocks = useCallback(async (nextFilters: DashboardFilters) => {
    setBusinessBlocksLoading(true);
    try {
      const response = await fetch(`/api/dashboard/business-blocks?${toQuery(nextFilters)}`);
      const data = (await response.json()) as BusinessBlocksData & { message?: string };
      if (!response.ok) throw new Error(data.message || "四板块经营数据加载失败");
      setBusinessBlocks({
        ...emptyBusinessBlocks,
        ...data,
        visibility: data.visibility ?? emptyBusinessBlocks.visibility,
        blockPerformance: data.blockPerformance ?? [],
        warnings: data.warnings ?? [],
        budgetSuggestions: data.budgetSuggestions ?? [],
        fieldDefinitions: data.fieldDefinitions ?? [],
      });
    } catch (loadError) {
      message.error(loadError instanceof Error ? loadError.message : "四板块经营数据加载失败");
      setBusinessBlocks(emptyBusinessBlocks);
    } finally {
      setBusinessBlocksLoading(false);
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
      void loadBusinessBlocks(filters);
    });
  }, [filters, loadBusinessBlocks, loadOverview]);

  function updateFilter(patch: Partial<DashboardFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function refreshDashboard() {
    void loadOverview(filters);
    void loadBusinessBlocks(filters);
  }

  function showAiPlaceholder() {
    message.info("AI 经营分析后续接入，当前版本支持手动评级和建议动作。");
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
                  if (value) updateFilter({ year: value.year(), month: value.month() + 1, quarter: Math.ceil((value.month() + 1) / 3) });
                }}
              />
              <Select
                placeholder="季度"
                value={filters.quarter}
                style={{ width: 100 }}
                options={[1, 2, 3, 4].map((quarter) => ({ label: `Q${quarter}`, value: quarter }))}
                onChange={(value) => updateFilter({ quarter: value })}
              />
              <Select allowClear showSearch optionFilterProp="label" placeholder="全部品牌" value={filters.brandId} style={{ width: 160 }} options={brandOptions} onChange={(value) => updateFilter({ brandId: value })} />
              <Select allowClear showSearch optionFilterProp="label" placeholder="全部平台" value={filters.platformId} style={{ width: 160 }} options={platformOptions} onChange={(value) => updateFilter({ platformId: value })} />
              <Select allowClear showSearch optionFilterProp="label" placeholder="全部店铺" value={filters.storeId} style={{ width: 180 }} options={storeOptions} onChange={(value) => updateFilter({ storeId: value })} />
              <Select allowClear showSearch optionFilterProp="label" placeholder="全部国家" value={filters.countryCode} style={{ width: 160 }} options={countryOptions} onChange={(value) => updateFilter({ countryCode: value })} />
              <Select allowClear placeholder="币种" value={filters.currency} style={{ width: 100 }} options={["CNY", "USD", "JPY", "EUR", "GBP"].map((currency) => ({ label: currency, value: currency }))} onChange={(value) => updateFilter({ currency: value })} />
            </Space>
            <Space>
              <Button icon={<ReloadOutlined />} loading={loading || businessBlocksLoading} onClick={refreshDashboard}>刷新数据</Button>
              <Button icon={<RobotOutlined />} onClick={showAiPlaceholder}>AI 分析</Button>
              <Button icon={<DownloadOutlined />} disabled>导出报表</Button>
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
              <TrendComposedChart data={overview.weeklyTrend} />
            </Card>
          </Col>

          <Col xs={24} xl={10}>
            <Card title="渠道销售占比">
              <BusinessLinePieChart data={overview.businessLineShare} />
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
              <TrendBarChart data={overview.weeklyTrend} />
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

      <Spin spinning={businessBlocksLoading}>
        <Card
          className="mt-4"
          title="四板块经营"
          extra={<Tag color={businessBlocks.visibility.canViewGlobal ? "green" : "orange"}>{businessBlocks.visibility.canViewGlobal ? "全局视角" : "已按角色脱敏"}</Tag>}
        >
          {businessBlocks.message ? <Alert type="info" showIcon message={businessBlocks.message} className="mb-4" /> : null}
          {businessBlocks.visibility.canViewGlobal ? (
            <>
              <Row gutter={[12, 12]} className="mb-4">
                <Col xs={24} md={6}><Card size="small"><Statistic title="销售额" value={moneyFormatter(businessBlocks.totals?.salesAmount ?? 0)} /></Card></Col>
                <Col xs={24} md={6}><Card size="small"><Statistic title="广告投入" value={moneyFormatter(businessBlocks.totals?.adSpend ?? 0)} /></Card></Col>
                <Col xs={24} md={6}><Card size="small"><Statistic title="经营毛利" value={moneyFormatter(businessBlocks.totals?.grossProfit ?? 0)} valueStyle={{ color: (businessBlocks.totals?.grossProfit ?? 0) < 0 ? "#cf1322" : "#172033" }} /></Card></Col>
                <Col xs={24} md={6}><Card size="small"><Statistic title="整体毛利率" value={percentFormatter(businessBlocks.totals?.grossMargin ?? null)} /></Card></Col>
              </Row>
              <Table columns={blockColumns} dataSource={businessBlocks.blockPerformance} rowKey={(row) => row.businessBlock} pagination={false} scroll={{ x: 1390 }} locale={{ emptyText: <Empty description="暂无四板块经营数据" /> }} />
            </>
          ) : (
            <Empty description="当前角色不能查看公司整体经营毛利、预算建议和全局经营表现" />
          )}
        </Card>

        <Card className="mt-4" title="预警与动作">
          {businessBlocks.visibility.canViewGlobal ? (
            <Table columns={warningColumns} dataSource={businessBlocks.warnings} rowKey={(row) => `${row.channelId}-${row.warningType}`} pagination={false} scroll={{ x: 1500 }} locale={{ emptyText: <Empty description="暂无预警，待 AI 分析或手动填写" /> }} />
          ) : (
            <Empty description="当前角色仅显示自己负责范围，暂不展示全局预警" />
          )}
        </Card>

        <Card className="mt-4" title="预算建议">
          {businessBlocks.visibility.canViewBudget ? (
            <Table columns={budgetColumns} dataSource={businessBlocks.budgetSuggestions} rowKey={(row) => row.businessBlock} pagination={false} scroll={{ x: 900 }} locale={{ emptyText: <Empty description="暂无预算建议，待填写 / 待 AI 分析" /> }} />
          ) : (
            <Alert type="info" showIcon message="预算建议属于管理员经营视角，当前角色不可查看。" />
          )}
        </Card>

        <Card className="mt-4" title="字段口径说明">
          <Table
            size="small"
            rowKey={(row) => row.field}
            columns={[
              { title: "字段", dataIndex: "field", width: 150 },
              { title: "口径说明", dataIndex: "description" },
            ]}
            dataSource={businessBlocks.fieldDefinitions}
            pagination={false}
          />
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
