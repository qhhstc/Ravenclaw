"use client";

import { Alert, Card } from "antd";
import { moneyText, type OrderRecord } from "./orderOptions";

export default function OrderPaymentPlaceholder({ order }: { order: OrderRecord }) {
  return (
    <Card>
      <Alert
        type="info"
        showIcon
        message="财务收款模块后续接入"
        description={`当前订单已收金额暂记录在订单字段 paidAmount 中：${moneyText(order.paidAmount, order.currency)}。`}
      />
    </Card>
  );
}
