"use client";

import { Empty } from "antd";
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
import { useThemeMode } from "@/hooks/useThemeMode";

const chartInitialDimension = { width: 560, height: 300 };

type TrendRow = { weekNumber: number; week: string; salesAmount: number; adSpend: number };
type ShareRow = { name: string; salesAmount: number; ratio: number };

function moneyFormatter(value: number) {
  return `¥${Math.round(value || 0).toLocaleString("zh-CN")}`;
}

function shortMoney(value: number) {
  const numericValue = Number(value || 0);
  if (Math.abs(numericValue) >= 10000) return `${Math.round(numericValue / 10000).toLocaleString("zh-CN")}万`;
  return `${Math.round(numericValue).toLocaleString("zh-CN")}`;
}

function percentFormatter(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(1)}%`;
}

function useChartPalette() {
  const mode = useThemeMode();
  return mode === "dark"
    ? {
        axis: "#b4b4b4",
        grid: "rgba(255,255,255,0.08)",
        tooltipBg: "#2f2f2f",
        tooltipBorder: "#3a3a3a",
        tooltipText: "#ececec",
        sales: "#3b82f6",
        adSpend: "#22c55e",
        profit: "#f59e0b",
        cost: "#ef4444",
        accent: ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316"],
      }
    : {
        axis: "#667085",
        grid: "#edf0f5",
        tooltipBg: "#ffffff",
        tooltipBorder: "#edf0f5",
        tooltipText: "#172033",
        sales: "#1677ff",
        adSpend: "#16a34a",
        profit: "#f59e0b",
        cost: "#ef4444",
        accent: ["#1677ff", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316"],
      };
}

export function TrendComposedChart({ data }: { data: TrendRow[] }) {
  const palette = useChartPalette();
  if (!data.some((item) => item.salesAmount > 0 || item.adSpend > 0)) return <Empty description="暂无趋势数据" />;
  return (
    <div className="h-[300px] min-h-[300px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} initialDimension={chartInitialDimension}>
        <ComposedChart data={data} margin={{ left: 12, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
          <XAxis dataKey="week" tick={{ fill: palette.axis }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <YAxis tick={{ fill: palette.axis }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} tickFormatter={(value) => shortMoney(Number(value))} />
          <Tooltip
            contentStyle={{ background: palette.tooltipBg, borderColor: palette.tooltipBorder, color: palette.tooltipText, borderRadius: 10 }}
            labelStyle={{ color: palette.tooltipText }}
            formatter={(value) => moneyFormatter(Number(value))}
          />
          <Legend wrapperStyle={{ color: palette.axis }} />
          <Bar dataKey="adSpend" name="广告费" fill={palette.adSpend} radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="salesAmount" name="销售额" stroke={palette.sales} strokeWidth={3} dot={{ r: 4, fill: palette.sales }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BusinessLinePieChart({ data }: { data: ShareRow[] }) {
  const palette = useChartPalette();
  if (!data.length) return <Empty description="暂无占比数据" />;
  return (
    <div className="h-[300px] min-h-[300px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} initialDimension={chartInitialDimension}>
        <PieChart>
          <Pie
            data={data}
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
            {data.map((entry, index) => <Cell key={entry.name} fill={palette.accent[index % palette.accent.length]} />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: palette.tooltipBg, borderColor: palette.tooltipBorder, color: palette.tooltipText, borderRadius: 10 }}
            labelStyle={{ color: palette.tooltipText }}
            formatter={(value) => moneyFormatter(Number(value))}
          />
          <Legend wrapperStyle={{ color: palette.axis }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendBarChart({ data }: { data: TrendRow[] }) {
  const palette = useChartPalette();
  if (!data.some((item) => item.salesAmount > 0 || item.adSpend > 0)) return <Empty description="暂无对比数据" />;
  return (
    <div className="h-[300px] min-h-[300px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} initialDimension={chartInitialDimension}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
          <XAxis dataKey="week" tick={{ fill: palette.axis }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} />
          <YAxis tick={{ fill: palette.axis }} axisLine={{ stroke: palette.grid }} tickLine={{ stroke: palette.grid }} tickFormatter={(value) => shortMoney(Number(value))} />
          <Tooltip
            contentStyle={{ background: palette.tooltipBg, borderColor: palette.tooltipBorder, color: palette.tooltipText, borderRadius: 10 }}
            labelStyle={{ color: palette.tooltipText }}
            formatter={(value) => moneyFormatter(Number(value))}
          />
          <Legend wrapperStyle={{ color: palette.axis }} />
          <Bar dataKey="salesAmount" name="销售额" fill={palette.sales} radius={[4, 4, 0, 0]} />
          <Bar dataKey="adSpend" name="广告费" fill={palette.adSpend} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
