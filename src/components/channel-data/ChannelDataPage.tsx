"use client";

import { Card, Empty, Spin, Typography, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import ChannelFilters from "./ChannelFilters";
import ChannelImportModal from "./ChannelImportModal";
import ChannelKpiCards from "./ChannelKpiCards";
import MonthlySummaryTable from "./MonthlySummaryTable";
import QuarterSummary from "./QuarterSummary";
import WeeklyMetricTable from "./WeeklyMetricTable";
import { rowAdSpend, rowSales } from "./channelDataUtils";
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

const defaultFilters: ChannelDataFilters = {
  year: 2026,
  month: 5,
};

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
  const [importOpen, setImportOpen] = useState(false);

  const monthlyTotals = useMemo(() => {
    const salesAmount = rows.reduce((total, row) => total + rowSales(row), 0);
    const adSpend = rows.reduce((total, row) => total + rowAdSpend(row), 0);
    const advertisedChannelCount = rows.filter((row) => rowAdSpend(row) > 0).length;
    return { salesAmount, adSpend, channelCount: rows.length, advertisedChannelCount };
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
      setSummary(nextSummary);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "渠道数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(fetchOptions);
  }, [fetchOptions]);

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
          onSearch={setFilters}
          onReset={() => setFilters(defaultFilters)}
          onSave={saveRows}
          onDownloadTemplate={downloadTemplate}
          onImport={() => setImportOpen(true)}
          onExport={exportExcel}
        />
      </Spin>

      <ChannelKpiCards {...monthlyTotals} />

      <Card styles={{ body: { padding: 16 } }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <Typography.Title level={4} className="!mb-1">渠道周报录入</Typography.Title>
            <Typography.Text type="secondary">W1-W5 可直接编辑，保存后按渠道和周次 upsert 到数据库。</Typography.Text>
          </div>
        </div>
        {rows.length ? <WeeklyMetricTable rows={rows} loading={loading} onChange={setRows} /> : <Empty description="暂无渠道数据" />}
      </Card>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="mb-3">
          <Typography.Title level={4} className="!mb-1">月度汇总</Typography.Title>
          <Typography.Text type="secondary">由 W1-W5 自动汇总，支持按销售额、广告费、ROI 排序。</Typography.Text>
        </div>
        <MonthlySummaryTable rows={rows} loading={loading} />
      </Card>

      <QuarterSummary summary={summary} />
      <ChannelImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={() => fetchChannelData(filters)} />
    </div>
  );
}
