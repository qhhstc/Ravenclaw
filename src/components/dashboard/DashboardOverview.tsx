"use client";

import { DownloadOutlined, DollarOutlined, QuestionCircleOutlined, ReloadOutlined, RobotOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, DatePicker, Empty, Input, List, Modal, Progress, Row, Select, Space, Spin, Statistic, Table, Tag, Tooltip, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { todoCards } from "./dashboardData";

const TrendComposedChart = dynamic(() => import("./DashboardCharts").then((module) => module.TrendComposedChart), { ssr: false, loading: () => <div className="h-[300px] rounded-lg bg-[var(--soft-bg)]" /> });
const BusinessLinePieChart = dynamic(() => import("./DashboardCharts").then((module) => module.BusinessLinePieChart), { ssr: false, loading: () => <div className="h-[300px] rounded-lg bg-[var(--soft-bg)]" /> });
const TrendBarChart = dynamic(() => import("./DashboardCharts").then((module) => module.TrendBarChart), { ssr: false, loading: () => <div className="h-[300px] rounded-lg bg-[var(--soft-bg)]" /> });

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
    unpaidAmountBase?: number;
    currency?: string;
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

function currentDashboardFilters() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, quarter: Math.floor(now.getMonth() / 3) + 1 };
}

const defaultFilters = currentDashboardFilters();

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
    channelSalesAmount: number;
    orderSalesAmount: number;
    salesGapAmount: number;
    adSpend: number;
    roi: number | null;
    adSpendRatio: number | null;
    channelCount: number;
    paidChannelCount: number;
    netProfit: number;
    receivableAmount: number;
    receivableCount: number;
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
  companyReview?: {
    overallRating: string | null;
    overallSummary: string | null;
    topPriority: string | null;
    capitalShiftSuggestion: string | null;
    riskNotes: string[];
    aiModel: string | null;
    aiConfidence: string | null;
    aiAnalyzedAt: string | null;
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
    aiSummary?: string | null;
    aiRiskNotes?: string[];
    aiAnalyzedAt?: string | null;
    aiModel?: string | null;
    aiConfidence?: string | null;
    aiRatingReason?: string | null;
    decisionStatus?: string | null;
    nextBudget?: number | null;
    budgetAdjustReason?: string | null;
    remark?: string | null;
  }>;
  warnings: Array<{
    id: number | null;
    businessBlock: string;
    blockName: string;
    channelId: number | null;
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

type AiStatus = {
  enabled: boolean;
  provider: string;
  baseUrlConfigured: boolean;
  tokenConfigured: boolean;
  apiKeyConfigured: boolean;
  modelConfigured: boolean;
};

const emptyOverview: DashboardOverviewData = {
  kpis: { salesAmount: 0, channelSalesAmount: 0, orderSalesAmount: 0, salesGapAmount: 0, adSpend: 0, roi: null, adSpendRatio: null, channelCount: 0, paidChannelCount: 0, netProfit: 0, receivableAmount: 0, receivableCount: 0 },
  weeklyTrend: [],
  businessLineShare: [],
  roiRanking: [],
  weeklyTable: [],
};

const emptyBusinessBlocks: BusinessBlocksData = {
  visibility: { role: "viewer", scope: "limited", canViewGlobal: false, canViewProfit: false, canViewBudget: false, canEditDecisions: false },
  totals: null,
  companyReview: null,
  blockPerformance: [],
  warnings: [],
  budgetSuggestions: [],
  fieldDefinitions: [],
};

// AI 状态本地化(与渠道表一致),避免看板显示英文 completed/pending
function aiStatusLabel(value?: string | null) {
  const labels: Record<string, string> = { pending: "待分析", analyzing: "分析中", completed: "已完成", failed: "失败" };
  return labels[value || ""] ?? "待分析";
}

function aiStatusColor(value?: string | null) {
  return value === "completed" ? "green" : value === "failed" ? "red" : value === "analyzing" ? "blue" : "default";
}

// 置信度本地化标签
function confidenceLabel(value?: string | null) {
  const labels: Record<string, string> = { high: "高", medium: "中", low: "低" };
  return value && labels[value] ? `置信度${labels[value]}` : "";
}

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

function warningLevelTag(value?: string | null) {
  const normalized = value?.trim().toUpperCase();
  const level = normalized === "A" || normalized === "B" || normalized === "C" || normalized === "D" ? normalized : "B";
  const colorMap: Record<string, string> = { A: "green", B: "blue", C: "orange", D: "red" };
  return <Tag color={colorMap[level]}>{level}</Tag>;
}

function mutedEmpty(text = "未填写") {
  return <span className="text-xs text-[var(--muted-weak)]">{text}</span>;
}

function twoLineText(value?: string | null) {
  const text = value?.trim();
  if (!text) return mutedEmpty();
  return (
    <Tooltip title={text}>
      <div
        className="text-sm leading-5 text-[var(--foreground)]"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          overflow: "hidden",
        }}
      >
        {text}
      </div>
    </Tooltip>
  );
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

function BusinessBlockMetric({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--soft-bg)] px-3 py-2">
      <div className="text-xs text-[var(--muted)]">{title}</div>
      <div className="mt-1 text-right text-sm font-semibold text-[var(--foreground)]">{children}</div>
    </div>
  );
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
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [definitionOpen, setDefinitionOpen] = useState(false);
  const [blockDetail, setBlockDetail] = useState<BusinessBlocksData["blockPerformance"][number] | null>(null);
  const [editingWarning, setEditingWarning] = useState<BusinessBlocksData["warnings"][number] | null>(null);
  const [warningDraft, setWarningDraft] = useState({
    manualActionSuggestion: "",
    decisionOwner: "",
    decisionDeadline: "",
    warningLevel: "B",
    remark: "",
  });
  const [savingWarning, setSavingWarning] = useState(false);

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
            <div className="font-medium text-[var(--foreground)]">{row.channelName}</div>
            <div className="text-xs text-[var(--muted-weak)]">{row.storeName}</div>
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

  const warningColumns = useMemo<ColumnsType<BusinessBlocksData["warnings"][number]>>(() => {
    const warnings = businessBlocks.warnings;
    const hasChannel = warnings.some((row) => row.channelId && row.channelName && row.channelName !== "-");
    const hasMonthOverMonth = warnings.some((row) => row.monthOverMonth !== null && row.monthOverMonth !== undefined);
    const hasDecisionOwner = warnings.some((row) => row.decisionOwner?.trim());
    const hasDecisionDeadline = warnings.some((row) => row.decisionDeadline);
    const columns: ColumnsType<BusinessBlocksData["warnings"][number]> = [
      { title: "板块", dataIndex: "blockName", width: 110 },
    ];

    if (hasChannel) columns.push({ title: "渠道", dataIndex: "channelName", width: 160, render: (value?: string) => value || mutedEmpty() });

    columns.push(
      { title: "异常类型", dataIndex: "warningType", width: 180, render: twoLineText },
      { title: "本月数据", dataIndex: "currentValue", width: 130, align: "right", render: moneyFormatter },
    );

    if (hasMonthOverMonth) columns.push({ title: "环比", dataIndex: "monthOverMonth", width: 100, align: "right", render: percentFormatter });

    columns.push({ title: "建议动作", dataIndex: "suggestedAction", width: 380, render: twoLineText });

    if (hasDecisionOwner) columns.push({ title: "负责人", dataIndex: "decisionOwner", width: 120, render: (value?: string) => value || mutedEmpty() });
    if (hasDecisionDeadline) columns.push({ title: "决策 deadline", dataIndex: "decisionDeadline", width: 140, render: (value?: string | null) => (value ? dayjs(value).format("YYYY-MM-DD") : mutedEmpty()) });

    columns.push(
      { title: "预警等级", dataIndex: "warningLevel", width: 100, render: warningLevelTag },
      { title: "备注", dataIndex: "remark", width: 220, render: twoLineText },
      {
        title: "操作",
        key: "action",
        width: 120,
        fixed: "right",
        render: (_, row) => (
          <Button type="link" size="small" disabled={!businessBlocks.visibility.canEditDecisions || !row.id} onClick={() => openWarningEditor(row)}>
            编辑决策
          </Button>
        ),
      },
    );

    return columns;
  }, [businessBlocks.visibility.canEditDecisions, businessBlocks.warnings]);

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
    { title: "渠道销售额", value: moneyFormatter(overview.kpis.channelSalesAmount ?? overview.kpis.salesAmount) },
    { title: "订单销售额", value: moneyFormatter(overview.kpis.orderSalesAmount ?? 0) },
    { title: "口径差异", value: moneyFormatter(overview.kpis.salesGapAmount ?? 0) },
    { title: "本月广告费", value: moneyFormatter(overview.kpis.adSpend) },
    { title: "整体 ROI", value: ratioFormatter(overview.kpis.roi) },
    { title: "广告占比", value: percentFormatter(overview.kpis.adSpendRatio) },
    { title: "渠道数量", value: overview.kpis.channelCount },
    { title: "有广告费渠道数", value: overview.kpis.paidChannelCount },
    { title: "净利润", value: moneyFormatter(overview.kpis.netProfit) },
    { title: "应收账款", value: moneyFormatter(overview.kpis.receivableAmount) },
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

  const loadAiStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/ai/status");
      const data = (await response.json()) as AiStatus & { message?: string };
      if (!response.ok) throw new Error(data.message || "AI 状态加载失败");
      setAiStatus(data);
    } catch {
      setAiStatus(null);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadOptions();
      void loadFollowupCustomers();
      void loadPendingPayments();
      void loadAiStatus();
    });
  }, [loadAiStatus, loadFollowupCustomers, loadOptions, loadPendingPayments]);

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

  function openWarningEditor(row: BusinessBlocksData["warnings"][number]) {
    if (!row.id) {
      message.info("系统规则预警尚未入库，AI 分析生成预警后可编辑决策。");
      return;
    }
    setEditingWarning(row);
    setWarningDraft({
      manualActionSuggestion: row.suggestedAction === "待填写 / 待 AI 分析" ? "" : row.suggestedAction || "",
      decisionOwner: row.decisionOwner || "",
      decisionDeadline: row.decisionDeadline || "",
      warningLevel: row.warningLevel || "B",
      remark: row.remark || "",
    });
  }

  async function saveWarningDecision() {
    if (!editingWarning?.id) return;
    setSavingWarning(true);
    try {
      const response = await fetch(`/api/dashboard/business-warnings/${editingWarning.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(warningDraft),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(data.message || "预警决策保存失败");
      message.success("预警决策已保存");
      setEditingWarning(null);
      await loadBusinessBlocks(filters);
    } catch (saveError) {
      message.error(saveError instanceof Error ? saveError.message : "预警决策保存失败");
    } finally {
      setSavingWarning(false);
    }
  }

  const aiConfigured = Boolean(aiStatus?.enabled && aiStatus.modelConfigured && (aiStatus.tokenConfigured || aiStatus.apiKeyConfigured));

  async function runBusinessBlockAnalysis() {
    if (!businessBlocks.visibility.canEditDecisions) {
      message.warning("只有管理员可以触发全局 AI 分析");
      return;
    }
    if (!aiConfigured) {
      message.warning("AI 分析未配置，请在服务器 .env 开启 AI_ANALYSIS_ENABLED 并配置 Token 与模型");
      return;
    }
    setAiRunning(true);
    try {
      const response = await fetch("/api/ai/business-block-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: filters.year, month: filters.month, brandId: filters.brandId }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "四板块 AI 分析失败");
      message.success(data.message || "AI 分析完成");
      await loadBusinessBlocks(filters);
    } catch (runError) {
      message.error(runError instanceof Error ? runError.message : "四板块 AI 分析失败");
    } finally {
      setAiRunning(false);
    }
  }

  function filenameFromDisposition(disposition: string | null, fallback: string) {
    const utf8Match = disposition?.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
    const fallbackMatch = disposition?.match(/filename="?([^";]+)"?/i);
    return fallbackMatch?.[1] ?? fallback;
  }

  async function exportDashboard() {
    setExporting(true);
    try {
      const response = await fetch(`/api/dashboard/export?${toQuery(filters)}`);
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "导出失败");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filenameFromDisposition(response.headers.get("Content-Disposition"), "经营看板.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      message.success("经营看板 Excel 已开始下载");
    } catch (exportError) {
      message.error(exportError instanceof Error ? exportError.message : "导出失败");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="page-stack page-stack-lg">
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
              {businessBlocks.visibility.canEditDecisions ? (
                <Button icon={<RobotOutlined />} loading={aiRunning} disabled={!aiConfigured && Boolean(aiStatus)} onClick={runBusinessBlockAnalysis}>
                  AI 分析四板块经营
                </Button>
              ) : null}
              {businessBlocks.visibility.canViewProfit ? <Button icon={<DownloadOutlined />} loading={exporting} onClick={exportDashboard}>导出报表</Button> : null}
            </Space>
          </div>
        </Spin>
      </Card>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <Spin spinning={loading}>
        <div className="space-y-4">
          <Row gutter={[16, 16]}>
            {kpiCards.map((item) => (
              <Col xs={24} sm={12} lg={8} xl={6} xxl={3} key={item.title}>
                <Card className="h-full" styles={{ body: { padding: 16 } }}>
                  <Statistic title={item.title} value={item.value} styles={{ content: { color: "var(--foreground)", fontSize: 22 } }} />
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={14}>
              <Card className="dashboard-chart-card h-full" title="销售额 vs 广告费趋势">
                <TrendComposedChart data={overview.weeklyTrend} />
              </Card>
            </Col>

            <Col xs={24} xl={10}>
              <Card className="dashboard-chart-card h-full" title="渠道销售占比">
                <BusinessLinePieChart data={overview.businessLineShare} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={8}>
              <Card className="h-full" title="渠道 ROI 排行">
                {overview.roiRanking.length ? (
                  <div className="space-y-4">
                    {overview.roiRanking.map((item) => (
                      <div key={item.channelId}>
                        <div className="mb-2 flex items-center justify-between gap-4">
                          <Space>
                            <Tag color={item.rank <= 3 ? "blue" : "default"}>{item.rank}</Tag>
                            <span className="font-medium text-[var(--foreground)]">{item.channelName}</span>
                          </Space>
                          <span className="text-sm text-[var(--muted)]">{item.storeName}</span>
                        </div>
                        <Progress percent={Math.min((item.roi ?? 0) * 10, 100)} showInfo={false} strokeColor="var(--chart-blue)" trailColor="var(--soft-bg)" />
                        <div className="mt-1 flex justify-between text-xs text-[var(--muted)]">
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
              <Card className="dashboard-chart-card h-full" title="销售额与广告费对比">
                <TrendBarChart data={overview.weeklyTrend} />
              </Card>
            </Col>
          </Row>

          <Card
            title="渠道周报表格"
            extra={<Link href="/channel-data">查看全部</Link>}
          >
            <Table columns={columns} dataSource={overview.weeklyTable} rowKey={(row) => String(row.channelId)} pagination={false} scroll={{ x: 1650 }} size="middle" locale={{ emptyText: <Empty description="暂无周报数据" /> }} />
          </Card>
        </div>
      </Spin>

      <Spin spinning={businessBlocksLoading}>
        <div className="flex flex-col gap-6">
          <Card
            title={
              <Space size={6}>
                <span>四板块经营</span>
                <Button
                  type="text"
                  size="small"
                  icon={<QuestionCircleOutlined />}
                  onClick={() => setDefinitionOpen(true)}
                  title="查看字段口径说明"
                />
              </Space>
            }
            extra={<Tag color={businessBlocks.visibility.canViewGlobal ? "green" : "orange"}>{businessBlocks.visibility.canViewGlobal ? "全局视角" : "已按角色脱敏"}</Tag>}
          >
            {businessBlocks.message ? <Alert type="info" showIcon message={businessBlocks.message} className="mb-4" /> : null}
            {businessBlocks.visibility.canViewGlobal ? (
              <>
                <Row gutter={[16, 16]} className="mb-4">
                  <Col xs={24} md={6}><Card className="h-full" size="small"><Statistic title="销售额" value={moneyFormatter(businessBlocks.totals?.salesAmount ?? 0)} /></Card></Col>
                  <Col xs={24} md={6}><Card className="h-full" size="small"><Statistic title="广告投入" value={moneyFormatter(businessBlocks.totals?.adSpend ?? 0)} /></Card></Col>
                  <Col xs={24} md={6}><Card className="h-full" size="small"><Statistic title="经营毛利" value={moneyFormatter(businessBlocks.totals?.grossProfit ?? 0)} valueStyle={{ color: (businessBlocks.totals?.grossProfit ?? 0) < 0 ? "var(--danger)" : "var(--foreground)" }} /></Card></Col>
                  <Col xs={24} md={6}><Card className="h-full" size="small"><Statistic title="整体毛利率" value={percentFormatter(businessBlocks.totals?.grossMargin ?? null)} /></Card></Col>
                </Row>
                {businessBlocks.companyReview ? (
                  <Card
                    size="small"
                    className="mb-4 border-l-4"
                    style={{ borderLeftColor: "var(--ai, #722ed1)" }}
                    title={
                      <Space size={8} wrap>
                        <span>🏆 公司经营总评</span>
                        {businessBlocks.companyReview.overallRating ? <Tag color="purple">综合评级 {businessBlocks.companyReview.overallRating}</Tag> : null}
                        {confidenceLabel(businessBlocks.companyReview.aiConfidence) ? <Tag color="cyan">{confidenceLabel(businessBlocks.companyReview.aiConfidence)}</Tag> : null}
                      </Space>
                    }
                    extra={
                      <Space size={8} className="text-xs text-[var(--muted)]">
                        {businessBlocks.companyReview.aiModel ? <span>模型：{businessBlocks.companyReview.aiModel}</span> : null}
                        {businessBlocks.companyReview.aiAnalyzedAt ? <span>{dayjs(businessBlocks.companyReview.aiAnalyzedAt).format("MM-DD HH:mm")}</span> : null}
                      </Space>
                    }
                  >
                    <div className="space-y-2 text-sm">
                      <div className="dashboard-ai-summary text-[var(--foreground)]">{businessBlocks.companyReview.overallSummary || "暂无总评"}</div>
                      {businessBlocks.companyReview.topPriority ? (
                        <div><Tag color="red">第一优先</Tag><span className="text-[var(--menu-text)]">{businessBlocks.companyReview.topPriority}</span></div>
                      ) : null}
                      {businessBlocks.companyReview.capitalShiftSuggestion ? (
                        <div><Tag color="gold">预算挪动</Tag><span className="text-[var(--menu-text)]">{businessBlocks.companyReview.capitalShiftSuggestion}</span></div>
                      ) : null}
                      {businessBlocks.companyReview.riskNotes?.length ? (
                        <div className="text-[var(--muted)]">公司风险：{businessBlocks.companyReview.riskNotes.join("；")}</div>
                      ) : null}
                    </div>
                  </Card>
                ) : null}
                {businessBlocks.blockPerformance.length ? (
                  <div className="overflow-x-auto">
                    <div className="grid min-w-[1060px] grid-cols-4 gap-4">
                      {businessBlocks.blockPerformance.map((block) => (
                        <div key={block.businessBlock} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                              <Typography.Text strong>{block.blockName}</Typography.Text>
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                <Tag color={aiStatusColor(block.aiAnalysisStatus)} className="!m-0">{aiStatusLabel(block.aiAnalysisStatus)}</Tag>
                                {confidenceLabel(block.aiConfidence) ? <Tag className="!m-0" color="cyan">{confidenceLabel(block.aiConfidence)}</Tag> : null}
                              </div>
                            </div>
                            <Tag color={block.rating.source === "none" ? "default" : "purple"}>{block.rating.label}</Tag>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <BusinessBlockMetric title="销售额">{moneyFormatter(block.salesAmount)}</BusinessBlockMetric>
                            <BusinessBlockMetric title="销售占比">{percentFormatter(block.salesShare)}</BusinessBlockMetric>
                            <BusinessBlockMetric title="广告投入">{moneyFormatter(block.adSpend)}</BusinessBlockMetric>
                            <BusinessBlockMetric title="经营毛利">
                              <span className={block.grossProfit < 0 ? "text-red-500" : undefined}>{moneyFormatter(block.grossProfit)}</span>
                            </BusinessBlockMetric>
                            <BusinessBlockMetric title="毛利率">
                              <Tag color={rateColor(block.grossMargin)}>{percentFormatter(block.grossMargin)}</Tag>
                            </BusinessBlockMetric>
                            <BusinessBlockMetric title="ROI">
                              <Tag color={roiColor(block.roi)}>{ratioFormatter(block.roi)}</Tag>
                            </BusinessBlockMetric>
                            <BusinessBlockMetric title="环比上月">
                              <Tag color={block.monthOverMonth === null ? "default" : block.monthOverMonth >= 0 ? "green" : "red"}>
                                {percentFormatter(block.monthOverMonth)}
                              </Tag>
                            </BusinessBlockMetric>
                            <BusinessBlockMetric title="其他成本">{moneyFormatter(block.otherCost)}</BusinessBlockMetric>
                          </div>
	                          <div className="mt-4 space-y-2 rounded-lg bg-[var(--soft-bg)] p-3 text-sm text-[var(--menu-text)]">
	                            <div className="dashboard-ai-summary">AI 总结：{block.aiSummary || "待分析"}</div>
	                            {block.aiRiskNotes?.length ? (
	                              <div className="dashboard-ai-summary text-[var(--muted)]">风险：{block.aiRiskNotes.join("；")}</div>
	                            ) : null}
	                            <div className="dashboard-ai-summary">关键动作：{block.keyAction || "待填写 / 待 AI 分析"}</div>
                              <Button type="link" size="small" className="px-0" onClick={() => setBlockDetail(block)}>
                                查看 AI 分析
                              </Button>
	                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Empty description="暂无四板块经营数据" />
                )}
              </>
            ) : (
              <Empty description="当前角色不能查看公司整体经营毛利、预算建议和全局经营表现" />
            )}
          </Card>

          <Card title="预警与动作">
            {businessBlocks.visibility.canViewGlobal ? (
              <Table columns={warningColumns} dataSource={businessBlocks.warnings} rowKey={(row) => `${row.businessBlock}-${row.channelId ?? "block"}-${row.warningType}`} pagination={false} scroll={{ x: "max-content" }} locale={{ emptyText: <Empty description="暂无预警，待 AI 分析或手动填写" /> }} />
            ) : (
              <Empty description="当前角色仅显示自己负责范围，暂不展示全局预警" />
            )}
          </Card>

          <Card title="预算建议">
            {businessBlocks.visibility.canViewBudget ? (
              <Table columns={budgetColumns} dataSource={businessBlocks.budgetSuggestions} rowKey={(row) => row.businessBlock} pagination={false} scroll={{ x: 900 }} locale={{ emptyText: <Empty description="暂无预算建议，待填写 / 待 AI 分析" /> }} />
            ) : (
              <Alert type="info" showIcon message="预算建议属于管理员经营视角，当前角色不可查看。" />
            )}
          </Card>
        </div>
      </Spin>

      <Modal
        title="字段口径说明"
        open={definitionOpen}
        footer={null}
        width={760}
        onCancel={() => setDefinitionOpen(false)}
      >
        <Table
          size="small"
          rowKey={(row) => row.field}
          columns={[
            { title: "字段", dataIndex: "field", width: 150 },
            { title: "口径说明", dataIndex: "description" },
          ]}
          dataSource={businessBlocks.fieldDefinitions}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无字段口径说明" /> }}
        />
      </Modal>

      <Modal
        title="编辑预警决策"
        open={Boolean(editingWarning)}
        width={640}
        confirmLoading={savingWarning}
        okText="保存"
        cancelText="取消"
        onOk={saveWarningDecision}
        onCancel={() => setEditingWarning(null)}
      >
        {editingWarning ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-[var(--soft-bg)] p-3 text-sm text-[var(--muted)]">
              <div className="font-medium text-[var(--foreground)]">{editingWarning.blockName} · {editingWarning.warningType}</div>
              <div className="mt-1">本月数据：{moneyFormatter(editingWarning.currentValue)}</div>
            </div>
            <div>
              <Typography.Text type="secondary">建议动作</Typography.Text>
              <Input.TextArea
                className="mt-2"
                rows={3}
                value={warningDraft.manualActionSuggestion}
                placeholder="填写人工决策动作，保存后优先展示人工内容"
                onChange={(event) => setWarningDraft((current) => ({ ...current, manualActionSuggestion: event.target.value }))}
              />
            </div>
            <Row gutter={[12, 12]}>
              <Col xs={24} md={8}>
                <Typography.Text type="secondary">预警等级</Typography.Text>
                <Select
                  className="mt-2 w-full"
                  value={warningDraft.warningLevel}
                  options={["A", "B", "C", "D"].map((level) => ({ label: level, value: level }))}
                  onChange={(warningLevel) => setWarningDraft((current) => ({ ...current, warningLevel }))}
                />
              </Col>
              <Col xs={24} md={8}>
                <Typography.Text type="secondary">负责人</Typography.Text>
                <Input
                  className="mt-2"
                  value={warningDraft.decisionOwner}
                  placeholder="如：运营负责人"
                  onChange={(event) => setWarningDraft((current) => ({ ...current, decisionOwner: event.target.value }))}
                />
              </Col>
              <Col xs={24} md={8}>
                <Typography.Text type="secondary">Deadline</Typography.Text>
                <DatePicker
                  className="mt-2 w-full"
                  value={warningDraft.decisionDeadline ? dayjs(warningDraft.decisionDeadline) : null}
                  onChange={(value) => setWarningDraft((current) => ({ ...current, decisionDeadline: value ? value.format("YYYY-MM-DD") : "" }))}
                />
              </Col>
            </Row>
            <div>
              <Typography.Text type="secondary">备注</Typography.Text>
              <Input.TextArea
                className="mt-2"
                rows={2}
                value={warningDraft.remark}
                placeholder="补充判断依据或跟进说明"
                onChange={(event) => setWarningDraft((current) => ({ ...current, remark: event.target.value }))}
              />
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title={`${blockDetail?.blockName ?? ""} AI 分析详情`}
        open={Boolean(blockDetail)}
        footer={null}
        width={720}
        onCancel={() => setBlockDetail(null)}
      >
        {blockDetail ? (
          <div className="space-y-4">
            <Space wrap>
              <Tag color={blockDetail.rating.source === "none" ? "default" : "purple"}>{blockDetail.rating.label}</Tag>
              <Tag color={aiStatusColor(blockDetail.aiAnalysisStatus)}>{aiStatusLabel(blockDetail.aiAnalysisStatus)}</Tag>
              {confidenceLabel(blockDetail.aiConfidence) ? <Tag color="cyan">{confidenceLabel(blockDetail.aiConfidence)}</Tag> : null}
              {blockDetail.aiModel ? <span className="text-sm text-[var(--muted)]">模型：{blockDetail.aiModel}</span> : null}
              <span className="text-sm text-[var(--muted)]">分析时间：{formatDateTime(blockDetail.aiAnalyzedAt)}</span>
            </Space>
            {blockDetail.aiRatingReason ? (
              <Card size="small" title="评级依据">
                <Typography.Paragraph className="mb-0">{blockDetail.aiRatingReason}</Typography.Paragraph>
              </Card>
            ) : null}
            <Card size="small" title="AI 总结">
              <Typography.Paragraph className="mb-0">{blockDetail.aiSummary || "待分析"}</Typography.Paragraph>
            </Card>
            <Card size="small" title="风险提示">
              {blockDetail.aiRiskNotes?.length ? (
                <List size="small" dataSource={blockDetail.aiRiskNotes} renderItem={(item) => <List.Item>{item}</List.Item>} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无风险提示" />
              )}
            </Card>
            <Card size="small" title="建议动作">
              <Typography.Paragraph className="mb-0">{blockDetail.keyAction || "待填写 / 待 AI 分析"}</Typography.Paragraph>
            </Card>
            <Card size="small" title="预算建议">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <BusinessBlockMetric title="下月建议预算">
                  {blockDetail.nextBudget === null || blockDetail.nextBudget === undefined ? "待填写" : moneyFormatter(blockDetail.nextBudget)}
                </BusinessBlockMetric>
                <BusinessBlockMetric title="调整逻辑">{blockDetail.budgetAdjustReason || "待填写 / 待 AI 分析"}</BusinessBlockMetric>
              </div>
            </Card>
            {blockDetail.remark ? (
              <Card size="small" title="人工备注">
                <Typography.Paragraph className="mb-0">{blockDetail.remark}</Typography.Paragraph>
              </Card>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Typography.Text type="secondary">近期询盘</Typography.Text>
            <div className="mt-3 text-2xl font-semibold text-[var(--foreground)]">待接入</div>
            <div className="mt-2 text-sm text-[var(--muted)]">询盘报价模块上线后接入</div>
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
                <div className="rounded-lg bg-[var(--chart-amber-soft)] p-2">
                  <div className="text-lg font-semibold text-orange-500">{followupCustomers.todayCount}</div>
                  <div className="text-xs text-[var(--muted)]">今日</div>
                </div>
                <div className="rounded-lg bg-[var(--chart-red-soft)] p-2">
                  <div className="text-lg font-semibold text-red-500">{followupCustomers.overdueCount}</div>
                  <div className="text-xs text-[var(--muted)]">逾期</div>
                </div>
                <div className="rounded-lg bg-[var(--chart-blue-soft)] p-2">
                  <div className="text-lg font-semibold text-[var(--chart-blue)]">{followupCustomers.next7DaysCount}</div>
                  <div className="text-xs text-[var(--muted)]">7天</div>
                </div>
              </div>
              {followupCustomers.items.length ? (
                <List
                  size="small"
                  dataSource={followupCustomers.items}
                  renderItem={(item) => (
                    <List.Item className="!px-0">
                      <List.Item.Meta
                        avatar={<UserOutlined className={item.overdue ? "text-red-500" : "text-[var(--chart-blue)]"} />}
                        title={<Link href={`/crm/customers/${item.id}`}>{item.name}</Link>}
                        description={`${item.countryCode ?? "-"} · ${customerStatusLabels[item.status] ?? item.status} · ${item.owner?.name ?? "-"}`}
                      />
                      <span className={item.overdue ? "text-xs text-red-500" : "text-xs text-[var(--muted)]"}>{formatDateTime(item.nextFollowupAt)}</span>
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
                <div className="rounded-lg bg-[var(--chart-amber-soft)] p-2">
                  <div className="text-lg font-semibold text-orange-500">{pendingPayments.pendingOrderCount}</div>
                  <div className="text-xs text-[var(--muted)]">待回款</div>
                </div>
                <div className="rounded-lg bg-[var(--chart-red-soft)] p-2">
                  <div className="text-lg font-semibold text-red-500">{pendingPayments.overdueOrderCount}</div>
                  <div className="text-xs text-[var(--muted)]">逾期</div>
                </div>
                <div className="rounded-lg bg-[var(--chart-blue-soft)] p-2">
                  <div className="text-lg font-semibold text-[var(--chart-blue)]">{shortMoney(pendingPayments.pendingAmount)}</div>
                  <div className="text-xs text-[var(--muted)]">未收金额</div>
                </div>
              </div>
              {pendingPayments.items.length ? (
                <List
                  size="small"
                  dataSource={pendingPayments.items}
                  renderItem={(item) => (
                    <List.Item className="!px-0">
                      <List.Item.Meta
                        avatar={<DollarOutlined className={item.overdue ? "text-red-500" : "text-[var(--chart-blue)]"} />}
                        title={<Link href={`/orders/${item.id}`}>{item.orderNo}</Link>}
                        description={`${item.customerName} · ${item.countryCode ?? "-"} · 未收 ${item.currency ?? "订单币种"} ${Number(item.unpaidAmount || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / 本位币 ${moneyFormatter(item.unpaidAmountBase ?? item.unpaidAmount)}`}
                      />
                      <span className={item.overdue ? "text-xs text-red-500" : "text-xs text-[var(--muted)]"}>{formatDateTime(item.dueDate)}</span>
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
              <div className="mt-3 text-2xl font-semibold text-[var(--foreground)]">待接入</div>
              <div className="mt-2 text-sm text-[var(--muted)]">{item.description}</div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
