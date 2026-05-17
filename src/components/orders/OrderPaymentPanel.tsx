"use client";

import { Button, Card, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useState } from "react";
import { formatDate, formatDateTime, moneyText, type OrderPaymentRecord, type OrderRecord } from "./orderOptions";

type Props = {
  order: OrderRecord;
  canWrite: boolean;
  onChanged: () => Promise<void> | void;
};

const paymentMethodOptions = ["银行转账", "PayPal", "Stripe", "平台结算", "现金", "其他"].map((value) => ({ label: value, value }));

function serializeDate(value: unknown) {
  return value && typeof value === "object" && "toISOString" in value ? (value as dayjs.Dayjs).toISOString() : null;
}

export default function OrderPaymentPanel({ order, canWrite, onChanged }: Props) {
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [voidingId, setVoidingId] = useState<number | null>(null);

  async function savePayment() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const response = await fetch(`/api/orders/${order.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, paymentDate: serializeDate(values.paymentDate), currency: order.currency, exchangeRate: order.exchangeRate }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "收款登记失败");
      message.success("收款记录已登记");
      setOpen(false);
      await onChanged();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "收款登记失败");
    } finally {
      setSaving(false);
    }
  }

  async function voidPayment(paymentId: number) {
    setVoidingId(paymentId);
    try {
      const response = await fetch(`/api/orders/${order.id}/payments/${paymentId}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "收款记录作废失败");
      message.success("收款记录已作废");
      await onChanged();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "收款记录作废失败");
    } finally {
      setVoidingId(null);
    }
  }

  const columns: ColumnsType<OrderPaymentRecord> = [
    { title: "收款日期", dataIndex: "paymentDate", width: 120, render: formatDate },
    { title: "收款金额", dataIndex: "amount", width: 140, align: "right", render: (value, row) => <b>{moneyText(value, row.currency || order.currency)}</b> },
    { title: "方式", dataIndex: "paymentMethod", width: 120, render: (value) => value || "-" },
    { title: "流水/凭证号", dataIndex: "referenceNo", width: 180, render: (value) => value || "-" },
    { title: "付款方", dataIndex: "payerName", width: 160, render: (value) => value || "-" },
    { title: "登记人", dataIndex: ["creator", "name"], width: 120, render: (_value, row) => row.creator?.name || "-" },
    { title: "登记时间", dataIndex: "createdAt", width: 160, render: formatDateTime },
    { title: "备注", dataIndex: "remark", render: (value) => value || "-" },
    {
      title: "操作",
      width: 90,
      fixed: "right",
      render: (_value, row) =>
        canWrite ? (
          <Popconfirm title="确定作废这条收款记录吗？" okText="作废" cancelText="取消" onConfirm={() => voidPayment(row.id)}>
            <Button danger size="small" loading={voidingId === row.id}>作废</Button>
          </Popconfirm>
        ) : null,
    },
  ];

  return (
    <Card
      title="收款记录"
      extra={canWrite ? <Button type="primary" onClick={() => setOpen(true)}>新增收款</Button> : null}
      styles={{ body: { padding: 16 } }}
    >
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <Typography.Text type="secondary">订单金额</Typography.Text>
          <div className="mt-1 text-xl font-semibold">{moneyText(order.salesAmount, order.currency)}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <Typography.Text type="secondary">已收金额</Typography.Text>
          <div className="mt-1 text-xl font-semibold text-[var(--success)]">{moneyText(order.paidAmount, order.currency)}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <Typography.Text type="secondary">未收金额</Typography.Text>
          <div className="mt-1 text-xl font-semibold text-[var(--warning)]">{moneyText(order.unpaidAmount, order.currency)}</div>
        </div>
      </div>

      <Table rowKey="id" columns={columns} dataSource={order.payments ?? []} pagination={false} scroll={{ x: 1180 }} />

      <Modal
        title={`新增收款 - ${order.orderNo}`}
        open={open}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        onOk={savePayment}
        onCancel={() => setOpen(false)}
        destroyOnHidden
        afterOpenChange={(visible) => {
          if (visible) {
            form.setFieldsValue({
              paymentDate: dayjs(),
              amount: Number(order.unpaidAmount) > 0 ? Number(order.unpaidAmount) : undefined,
              paymentMethod: order.paymentMethod || undefined,
            });
          } else {
            form.resetFields();
          }
        }}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="paymentDate" label="收款日期" rules={[{ required: true, message: "请选择收款日期" }]}>
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item name="amount" label={`收款金额（${order.currency}）`} rules={[{ required: true, message: "请输入收款金额" }]}>
            <InputNumber min={0.01} precision={2} className="!w-full" />
          </Form.Item>
          <Form.Item name="paymentMethod" label="收款方式">
            <Select allowClear options={paymentMethodOptions} />
          </Form.Item>
          <Form.Item name="referenceNo" label="流水号/凭证号">
            <Input placeholder="例如银行流水号、PayPal Transaction ID" />
          </Form.Item>
          <Form.Item name="payerName" label="付款方">
            <Input placeholder="客户公司名或付款账户名" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="例如定金、尾款、平台结算周期等" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
