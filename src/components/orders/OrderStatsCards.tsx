"use client";

import { Card, Col, Row, Statistic, Tag } from "antd";
import { compactMoneyText } from "./orderOptions";

export type OrderStatsData = {
  monthOrderCount: number;
  monthTotalAmount: number;
  monthPaidAmount: number;
  monthUnpaidAmount: number;
  pendingPaymentCount: number;
  overduePaymentCount: number;
};

const emptyStats: OrderStatsData = {
  monthOrderCount: 0,
  monthTotalAmount: 0,
  monthPaidAmount: 0,
  monthUnpaidAmount: 0,
  pendingPaymentCount: 0,
  overduePaymentCount: 0,
};

export { emptyStats };

export default function OrderStatsCards({ stats }: { stats: OrderStatsData }) {
  const cards = [
    { title: "本月订单数", value: stats.monthOrderCount, tag: "订单", color: "blue" },
    { title: "本月订单金额", value: compactMoneyText(stats.monthTotalAmount), tag: "金额", color: "cyan" },
    { title: "本月已收金额", value: compactMoneyText(stats.monthPaidAmount), tag: "已收", color: "green" },
    { title: "本月未收金额", value: compactMoneyText(stats.monthUnpaidAmount), tag: "未收", color: "orange" },
    { title: "待回款订单", value: stats.pendingPaymentCount, tag: "待处理", color: "red" },
    { title: "逾期回款订单", value: stats.overduePaymentCount, tag: "逾期", color: "volcano" },
  ];

  return (
    <Row gutter={[12, 12]}>
      {cards.map((card) => (
        <Col xs={24} sm={12} lg={8} xl={4} key={card.title}>
          <Card styles={{ body: { padding: 16 } }}>
            <Statistic title={card.title} value={card.value} styles={{ content: { color: "var(--foreground)", fontSize: 22 } }} />
            <div className="mt-3"><Tag color={card.color}>{card.tag}</Tag></div>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
