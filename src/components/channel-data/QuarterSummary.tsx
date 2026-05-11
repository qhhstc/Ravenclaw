"use client";

import { Alert, Card, Col, Row, Statistic, Typography } from "antd";
import { currencyMoney, percent, ratio } from "./channelDataUtils";
import type { ChannelSummaryResponse } from "./channelDataTypes";

type QuarterSummaryProps = {
  summary?: ChannelSummaryResponse | null;
};

export default function QuarterSummary({ summary }: QuarterSummaryProps) {
  const quarter = summary?.quarter.quarter ?? 2;
  const salesAmount = summary?.quarter.salesAmount ?? 0;
  const adSpend = summary?.quarter.adSpend ?? 0;
  const roi = adSpend > 0 ? salesAmount / adSpend : null;
  const adRatio = salesAmount > 0 ? adSpend / salesAmount : 0;
  const months = summary?.quarter.months ?? [];

  return (
    <Card styles={{ body: { padding: 16 } }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Title level={4} className="!mb-1">季度汇总</Typography.Title>
          <Typography.Text type="secondary">自动识别当前月份所属季度，统计已录入周报数据。</Typography.Text>
        </div>
        <Alert type="info" showIcon message={`当前为 Q${quarter}，仅统计已录入月份${months.length ? `：${months.join("、")}月` : ""}`} />
      </div>
      <Row gutter={[12, 12]}>
        <Col xs={24} md={6}><Statistic title="本季度销售额" value={currencyMoney(salesAmount)} /></Col>
        <Col xs={24} md={6}><Statistic title="本季度广告费" value={currencyMoney(adSpend)} /></Col>
        <Col xs={24} md={6}><Statistic title="本季度 ROI" value={ratio(roi)} /></Col>
        <Col xs={24} md={6}><Statistic title="本季度广告占比" value={percent(adRatio)} /></Col>
      </Row>
    </Card>
  );
}
