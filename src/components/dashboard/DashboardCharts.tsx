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

const chartColors = ["#1677ff", "#13c2c2", "#52c41a", "#faad14", "#eb2f96", "#722ed1", "#08979c", "#fa541c"];
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

export function TrendComposedChart({ data }: { data: TrendRow[] }) {
  if (!data.some((item) => item.salesAmount > 0 || item.adSpend > 0)) return <Empty description="暂无趋势数据" />;
  return (
    <div className="h-[300px] min-h-[300px] min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} initialDimension={chartInitialDimension}>
        <ComposedChart data={data} margin={{ left: 12, right: 12 }}>
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
  );
}

export function BusinessLinePieChart({ data }: { data: ShareRow[] }) {
  if (!data.length) return <Empty description="暂无占比数据" />;
  return (
    <div className="h-[300px] min-h-[300px] min-w-0">
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
            {data.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
          </Pie>
          <Tooltip formatter={(value) => moneyFormatter(Number(value))} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendBarChart({ data }: { data: TrendRow[] }) {
  if (!data.some((item) => item.salesAmount > 0 || item.adSpend > 0)) return <Empty description="暂无对比数据" />;
  return (
    <div className="h-[300px] min-h-[300px] min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} initialDimension={chartInitialDimension}>
        <BarChart data={data}>
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
  );
}
