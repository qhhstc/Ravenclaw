"use client";

import { Card, Empty, Modal, Spin, Typography, message } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChannelFilters from "./ChannelFilters";
import ChannelImportModal from "./ChannelImportModal";
import ChannelKpiCards from "./ChannelKpiCards";
import MonthlySummaryTable from "./MonthlySummaryTable";
import QuarterSummary from "./QuarterSummary";
import WeeklyMetricTable from "./WeeklyMetricTable";
import { rowAdSpend, rowAdSpendBase, rowSalesBase } from "./channelDataUtils";
import type { BasicOption, ChannelDataFilters, ChannelDataOptionState, ChannelDataResponse, ChannelDataRow, ChannelSummaryResponse } from "./channelDataTypes";

type BasicListResponse<T> = {
  items: T[];
  message?: string;
};

type BasicOptionRecord = {
  id: number;
  name?: string;
  code?: string;
};

type AiStatus = {
  enabled: boolean;
  tokenConfigured: boolean;
  apiKeyConfigured: boolean;
  modelConfigured: boolean;
};

function currentMonthFilters(): ChannelDataFilters {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

const defaultFilters: ChannelDataFilters = currentMonthFilters();

function toQuery(filters: ChannelDataFilters) {
  const params = new URLSearchParams({ year: String(filters.year), month: String(filters.month) });
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && key !== "year" && key !== "month") {
      params.set(key, String(value));
    }
  });
  return params.toString();
}

function toOptions(items: BasicOptionRecord[]): BasicOption[] {
  return items.map((item) => ({ label: item.name || item.code || String(item.id), value: item.id }));
}

export default function ChannelDataPage() {
  const [filters, setFilters] = useState<ChannelDataFilters>(defaultFilters);
  const [rows, setRows] = useState<ChannelDataRow[]>([]);
  const [summary, setSummary] = useState<ChannelSummaryResponse | null>(null);
  const [options, setOptions] = useState<ChannelDataOptionState>({ brands: [], platforms: [], stores: [] });
  const [loading, setLoading] = useState(false);
  const [optionLoading, setOptionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [currentRole, setCurrentRole] = useState("viewer");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // 编辑防丢失:记录最近一次 fetch/save 后的快照,用于判断是否有未保存改动
  const pristineRef = useRef<string>("[]");
  const [dirty, setDirty] = useState(false);

  // rows 变化时与快照比对,得出 dirty(仅周报录入字段,序列化对比足够)
  useEffect(() => {
    setDirty(JSON.stringify(rows) !== pristineRef.current);
  }, [rows]);

  // 有未保存改动时,拦截刷新/关闭页面
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const monthlyTotals = useMemo(() => {
    // KPI 跨渠道汇总统一用本位币(base = 原币×汇率),避免不同币种原币直接相加得到无意义数字
    const salesAmount = rows.reduce((total, row) => total + rowSalesBase(row), 0);
    const adSpend = rows.reduce((total, row) => total + rowAdSpendBase(row), 0);
    const advertisedChannelCount = rows.filter((row) => rowAdSpend(row) > 0).length;
    return { salesAmount, adSpend, channelCount: rows.length, advertisedChannelCount, currency: "CNY" };
  }, [rows]);

  const fetchOptions = useCallback(async () => {
    setOptionLoading(true);
    try {
      const [brandsResponse, platformsResponse, storesResponse] = await Promise.all([
        fetch("/api/basic/brands?pageSize=100&status=active"),
        fetch("/api/basic/platforms?pageSize=100&status=active"),
        fetch("/api/basic/stores?pageSize=100&status=active"),
      ]);
      const [brands, platforms, stores] = (await Promise.all([
        brandsResponse.json(),
        platformsResponse.json(),
        storesResponse.json(),
      ])) as [BasicListResponse<BasicOptionRecord>, BasicListResponse<BasicOptionRecord>, BasicListResponse<BasicOptionRecord>];

      if (!brandsResponse.ok) throw new Error(brands.message || "品牌选项加载失败");
      if (!platformsResponse.ok) throw new Error(platforms.message || "平台选项加载失败");
      if (!storesResponse.ok) throw new Error(stores.message || "店铺选项加载失败");

      setOptions({ brands: toOptions(brands.items), platforms: toOptions(platforms.items), stores: toOptions(stores.items) });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "基础资料选项加载失败");
    } finally {
      setOptionLoading(false);
    }
  }, []);

  const fetchAiStatus = useCallback(async () => {
    try {
      const [statusResponse, meResponse] = await Promise.all([fetch("/api/ai/status"), fetch("/api/auth/me")]);
      const status = (await statusResponse.json()) as AiStatus & { message?: string };
      const me = (await meResponse.json()) as { user?: { role?: string }; message?: string };
      if (statusResponse.ok) setAiStatus(status);
      if (meResponse.ok) setCurrentRole(me.user?.role ?? "viewer");
    } catch {
      setAiStatus(null);
      setCurrentRole("viewer");
    }
  }, []);

  const fetchChannelData = useCallback(async (nextFilters: ChannelDataFilters) => {
    setLoading(true);
    try {
      const query = toQuery(nextFilters);
      const [dataResponse, summaryResponse] = await Promise.all([
        fetch(`/api/channel-data?${query}`),
        fetch(`/api/channel-data/summary?${query}`),
      ]);
      const data = (await dataResponse.json()) as ChannelDataResponse & { message?: string };
      const nextSummary = (await summaryResponse.json()) as ChannelSummaryResponse & { message?: string };

      if (!dataResponse.ok) throw new Error(data.message || "渠道周报加载失败");
      if (!summaryResponse.ok) throw new Error(nextSummary.message || "渠道汇总加载失败");

      setRows(data.rows);
      pristineRef.current = JSON.stringify(data.rows); // 记录干净快照
      setSummary(nextSummary);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "渠道数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchOptions();
      void fetchAiStatus();
    });
  }, [fetchAiStatus, fetchOptions]);

  useEffect(() => {
    queueMicrotask(() => fetchChannelData(filters));
  }, [fetchChannelData, filters]);

  async function saveRows() {
    setSaving(true);
    try {
      const response = await fetch("/api/channel-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: filters.year, month: filters.month, rows }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "保存失败");
      message.success("本月渠道数据已保存");
      await fetchChannelData(filters);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  // 切月份/筛选/重置前,若有未保存改动先二次确认,避免静默丢弃录入
  function guardChange(action: () => void) {
    if (!dirty) {
      action();
      return;
    }
    Modal.confirm({
      title: "有未保存的修改",
      content: "当前周报数据尚未保存,切换月份或筛选会丢弃这些改动。确定放弃吗?",
      okText: "放弃改动",
      cancelText: "返回保存",
      okButtonProps: { danger: true },
      onOk: action,
    });
  }

  function requestFilters(next: ChannelDataFilters) {
    guardChange(() => setFilters(next));
  }

  function resetFilters() {
    guardChange(() => setFilters(defaultFilters));
  }

  async function triggerDownload(url: string) {
    setExporting(true);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "下载失败");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition");
      const utf8Match = disposition?.match(/filename\*=UTF-8''([^;]+)/i);
      const fallbackMatch = disposition?.match(/filename="?([^";]+)"?/i);
      const fileName = utf8Match?.[1] ? decodeURIComponent(utf8Match[1]) : fallbackMatch?.[1] ?? "渠道数据.xlsx";
    const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setExporting(false);
    }
  }

  function downloadTemplate() {
    triggerDownload("/api/channel-data/import-template").catch((error) => message.error(error instanceof Error ? error.message : "模板下载失败"));
  }

  function exportExcel() {
    triggerDownload(`/api/channel-data/export?${toQuery(filters)}`).then(() => message.success("渠道数据 Excel 已开始下载")).catch((error) => message.error(error instanceof Error ? error.message : "导出失败"));
  }

  const aiConfigured = Boolean(aiStatus?.enabled && aiStatus.modelConfigured && (aiStatus.tokenConfigured || aiStatus.apiKeyConfigured));
  const canRunAiAnalysis = currentRole === "admin";

  async function analyzeCurrentRows() {
    if (!canRunAiAnalysis) {
      message.warning("只有管理员可以触发渠道 AI 分析");
      return;
    }
    if (!aiConfigured) {
      message.warning("AI 分析未配置，请在服务器 .env 开启并配置 Token 与模型");
      return;
    }
    if (!rows.length) {
      message.info("当前筛选范围暂无渠道数据");
      return;
    }
    // AI 分析会以服务端数据覆盖当前表格,先提示保存未保存的手工编辑
    if (dirty) {
      message.warning("有未保存的手工编辑,请先点『保存本月数据』再做 AI 分析,否则编辑会被覆盖");
      return;
    }
    setAiAnalyzing(true);
    const targets = [...rows];
    const concurrency = 4;
    let done = 0;
    let success = 0;
    const failedChannels: string[] = [];
    const progressKey = "channel-ai-progress"; // 固定 key:原地更新同一条提示,避免每轮新建导致提示堆积不消失
    message.open({ key: progressKey, type: "loading", content: `AI 分析中 0/${targets.length}`, duration: 0 });
    try {
      // 带并发上限的批处理:单个渠道失败只记录不中断,结束后汇总
      for (let i = 0; i < targets.length; i += concurrency) {
        const batch = targets.slice(i, i + concurrency);
        const results = await Promise.allSettled(
          batch.map((row) =>
            fetch("/api/ai/channel-analysis", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ year: filters.year, month: filters.month, channelId: row.channelId, businessBlock: row.businessBlock }),
            }).then(async (response) => {
              if (!response.ok) {
                const data = (await response.json().catch(() => ({}))) as { message?: string };
                throw new Error(data.message || `${row.channelName} 分析失败`);
              }
            }),
          ),
        );
        results.forEach((result, index) => {
          done += 1;
          if (result.status === "fulfilled") success += 1;
          else failedChannels.push(batch[index].channelName);
        });
        // 原地更新同一条提示的进度文案,不新建
        if (i + concurrency < targets.length) {
          message.open({ key: progressKey, type: "loading", content: `AI 分析中 ${done}/${targets.length}`, duration: 0 });
        }
      }
      message.destroy(progressKey); // 进度提示先关掉,再弹结果
      if (failedChannels.length === 0) {
        message.success(`已完成全部 ${success} 个渠道 AI 分析`);
      } else {
        message.warning(`完成 ${success} 个,失败 ${failedChannels.length} 个:${failedChannels.slice(0, 5).join("、")}${failedChannels.length > 5 ? " 等" : ""}`);
      }
    } finally {
      message.destroy(progressKey); // 兜底:异常时也确保进度提示被关闭
      await fetchChannelData(filters);
      setAiAnalyzing(false);
    }
  }

  return (
    <div className="channel-data-page page-stack">
      <div className="page-section-header">
        <div>
          <Typography.Title level={3} className="!mb-1 !text-[var(--foreground)]">渠道数据</Typography.Title>
          <Typography.Text type="secondary">按周录入销售额和广告费，自动形成月度与季度经营效率汇总。</Typography.Text>
        </div>
      </div>

      <Spin spinning={optionLoading}>
        <ChannelFilters
          filters={filters}
          options={options}
          loading={loading}
          exporting={exporting}
          saving={saving}
          aiAnalyzing={aiAnalyzing}
          canRunAiAnalysis={canRunAiAnalysis}
          onSearch={requestFilters}
          onReset={resetFilters}
          onSave={saveRows}
          onDownloadTemplate={downloadTemplate}
          onImport={() => setImportOpen(true)}
          onExport={exportExcel}
          onAnalyzeAi={analyzeCurrentRows}
        />
      </Spin>

      <ChannelKpiCards {...monthlyTotals} />

      <Card styles={{ body: { padding: 16 } }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <Typography.Title level={4} className="!mb-1">渠道周报录入</Typography.Title>
            <Typography.Text type="secondary">W1-W5 可直接编辑，保存后按渠道和周次 upsert 到数据库。金额按各渠道录入的原始币种显示。</Typography.Text>
          </div>
          {dirty ? <Typography.Text type="warning">● 有未保存的修改</Typography.Text> : null}
        </div>
        {loading && !rows.length ? (
          <div className="grid place-items-center py-16"><Spin tip="加载中..." /></div>
        ) : rows.length ? (
          <WeeklyMetricTable rows={rows} loading={loading} onChange={setRows} />
        ) : (
          <Empty description="暂无渠道数据" />
        )}
      </Card>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="mb-3">
          <Typography.Title level={4} className="!mb-1">月度汇总</Typography.Title>
          <Typography.Text type="secondary">由 W1-W5 自动汇总，支持按销售额、广告费、ROI 排序。</Typography.Text>
        </div>
        <MonthlySummaryTable rows={rows} loading={loading} />
      </Card>

      <QuarterSummary summary={summary} />
      <ChannelImportModal
        open={importOpen}
        filters={filters}
        onClose={() => setImportOpen(false)}
        onImported={(importedFilters) => {
          if (importedFilters) {
            setFilters((current) => ({ ...current, ...importedFilters }));
            return;
          }
          return fetchChannelData(filters);
        }}
      />
    </div>
  );
}
