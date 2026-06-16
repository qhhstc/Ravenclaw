"use client";

import { Card, Col, Row, Statistic } from "antd";
import { BarChartOutlined, DollarOutlined, PercentageOutlined, RiseOutlined, ShopOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { currencyMoney, money, percent, ratio } from "./channelDataUtils";

type ChannelKpiCardsProps = {
  salesAmount: number;
  adSpend: number;
  channelCount: number;
  advertisedChannelCount: number;
  currency?: string | null;
};

export default function ChannelKpiCards({ salesAmount, adSpend, channelCount, advertisedChannelCount, currency }: ChannelKpiCardsProps) {
  const roi = adSpend > 0 ? salesAmount / adSpend : null;
  const adRatio = salesAmount > 0 ? adSpend / salesAmount : 0;
  // 销售额/广告费为原币聚合:整表同币种时带符号,混币种则不标符号
  const formatMoney = (value: number) => (currency ? currencyMoney(value, currency) : money(value));

  const items = [
    { title: "本月销售额(本位币¥)", value: formatMoney(salesAmount), icon: <DollarOutlined />, color: "var(--chart-blue)" },
    { title: "本月广告费(本位币¥)", value: formatMoney(adSpend), icon: <BarChartOutlined />, color: "var(--ai)" },
    { title: "整体 ROI", value: ratio(roi), icon: <RiseOutlined />, color: "var(--success)" },
    { title: "广告占比", value: percent(adRatio), icon: <PercentageOutlined />, color: "var(--warning)" },
    { title: "渠道数量", value: channelCount, icon: <ShopOutlined />, color: "var(--chart-teal)" },
    { title: "有广告费渠道数", value: advertisedChannelCount, icon: <ThunderboltOutlined />, color: "var(--chart-orange)" },
  ];

  return (
    <Row gutter={[12, 12]} className="mb-4">
      {items.map((item) => (
        <Col xs={24} sm={12} lg={8} xl={4} key={item.title}>
          <Card className="h-full" styles={{ body: { padding: 16 } }}>
            <div className="flex items-center justify-between gap-3">
              <Statistic title={item.title} value={item.value} valueStyle={{ fontSize: 20, color: "var(--foreground)" }} />
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg" style={{ color: item.color, background: `${item.color}14` }}>
                {item.icon}
              </div>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
