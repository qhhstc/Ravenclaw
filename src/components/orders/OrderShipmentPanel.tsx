"use client";

import { Button, Card, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Switch, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useState } from "react";
import { formatDate, formatDateTime, moneyText, type OrderRecord, type OrderShipmentRecord } from "./orderOptions";

type Props = {
  order: OrderRecord;
  canWrite: boolean;
  onChanged: () => Promise<void> | void;
};

const shipmentStatusOptions = [
  { label: "已发货", value: "shipped", color: "blue" },
  { label: "运输中", value: "in_transit", color: "purple" },
  { label: "已签收", value: "delivered", color: "green" },
];

function serializeDate(value: unknown) {
  return value && typeof value === "object" && "toISOString" in value ? (value as dayjs.Dayjs).toISOString() : null;
}

function statusTag(value?: string | null) {
  const option = shipmentStatusOptions.find((item) => item.value === value);
  return <Tag color={option?.color ?? "default"}>{option?.label ?? value ?? "-"}</Tag>;
}

export default function OrderShipmentPanel({ order, canWrite, onChanged }: Props) {
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  async function saveShipment() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const response = await fetch(`/api/orders/${order.id}/shipments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          shipmentDate: serializeDate(values.shipmentDate),
          deliveredAt: serializeDate(values.deliveredAt),
          currency: order.currency,
          exchangeRate: order.exchangeRate,
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "发货登记失败");
      message.success("发货记录已登记");
      setOpen(false);
      await onChanged();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "发货登记失败");
    } finally {
      setSaving(false);
    }
  }

  async function cancelShipment(shipmentId: number) {
    setCancellingId(shipmentId);
    try {
      const response = await fetch(`/api/orders/${order.id}/shipments/${shipmentId}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "发货记录取消失败");
      message.success("发货记录已取消");
      await onChanged();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "发货记录取消失败");
    } finally {
      setCancellingId(null);
    }
  }

  const columns: ColumnsType<OrderShipmentRecord> = [
    { title: "发货日期", dataIndex: "shipmentDate", width: 120, render: formatDate },
    { title: "状态", dataIndex: "status", width: 110, render: statusTag },
    { title: "物流商", dataIndex: "logisticsProvider", width: 140, render: (value) => value || "-" },
    { title: "物流单号", dataIndex: "trackingNo", width: 180, render: (value) => value || "-" },
    { title: "箱数", dataIndex: "packageCount", width: 90, align: "right" },
    { title: "运费", dataIndex: "freightAmount", width: 130, align: "right", render: (value, row) => moneyText(value, row.currency || order.currency) },
    { title: "是否尾票", dataIndex: "isFinalShipment", width: 100, render: (value) => (value ? <Tag color="green">尾票</Tag> : <Tag color="orange">部分发货</Tag>) },
    { title: "签收日期", dataIndex: "deliveredAt", width: 120, render: formatDate },
    { title: "登记人", dataIndex: ["creator", "name"], width: 120, render: (_value, row) => row.creator?.name || "-" },
    { title: "登记时间", dataIndex: "createdAt", width: 160, render: formatDateTime },
    { title: "备注", dataIndex: "remark", render: (value) => value || "-" },
    {
      title: "操作",
      width: 90,
      fixed: "right",
      render: (_value, row) =>
        canWrite ? (
          <Popconfirm title="确定取消这条发货记录吗？" okText="取消记录" cancelText="返回" onConfirm={() => cancelShipment(row.id)}>
            <Button danger size="small" loading={cancellingId === row.id}>取消</Button>
          </Popconfirm>
        ) : null,
    },
  ];

  return (
    <Card
      title="发货记录"
      extra={canWrite ? <Button type="primary" onClick={() => setOpen(true)}>新增发货</Button> : null}
      styles={{ body: { padding: 16 } }}
    >
      <Typography.Paragraph type="secondary">
        一笔订单可以分多次发货；如果不是最后一票，关闭“是否尾票”，订单会显示为部分发货。
      </Typography.Paragraph>
      <Table rowKey="id" columns={columns} dataSource={order.shipments ?? []} pagination={false} scroll={{ x: 1320 }} />

      <Modal
        title={`新增发货 - ${order.orderNo}`}
        open={open}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        onOk={saveShipment}
        onCancel={() => setOpen(false)}
        destroyOnHidden
        afterOpenChange={(visible) => {
          if (visible) {
            form.setFieldsValue({ shipmentDate: dayjs(), status: "shipped", isFinalShipment: true, packageCount: 1 });
          } else {
            form.resetFields();
          }
        }}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="shipmentDate" label="发货日期" rules={[{ required: true, message: "请选择发货日期" }]}>
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item name="status" label="发货状态">
            <Select options={shipmentStatusOptions.map(({ label, value }) => ({ label, value }))} />
          </Form.Item>
          <Form.Item name="logisticsProvider" label="物流商">
            <Input placeholder="例如 DHL / UPS / FedEx / 海运货代" />
          </Form.Item>
          <Form.Item name="trackingNo" label="物流单号">
            <Input placeholder="快递单号、柜号或货代单号" />
          </Form.Item>
          <Form.Item name="packageCount" label="箱数">
            <InputNumber min={1} precision={0} className="!w-full" />
          </Form.Item>
          <Form.Item name="freightAmount" label={`本票运费（${order.currency}）`}>
            <InputNumber min={0} precision={2} className="!w-full" />
          </Form.Item>
          <Form.Item name="isFinalShipment" label="是否尾票" valuePropName="checked">
            <Switch checkedChildren="尾票" unCheckedChildren="部分发货" />
          </Form.Item>
          <Form.Item name="deliveredAt" label="签收日期">
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="例如分批发货原因、报关资料、客户要求等" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
