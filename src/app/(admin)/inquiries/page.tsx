"use client";

import { ArrowRightOutlined, EditOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { moneyText } from "@/components/orders/orderOptions";

type QuoteRecord = {
  id: number;
  quoteNo: string;
  status: string;
  currency: string;
  totalAmount: number;
  productAmount?: number;
  shippingFee?: number;
  discountAmount?: number;
  taxAmount?: number;
  otherFee?: number;
  remark?: string | null;
  customer?: { name: string; companyName?: string | null } | null;
  inquiry?: { inquiryNo: string; title: string; status: string } | null;
  brand?: { name: string } | null;
  store?: { name: string } | null;
  order?: { id: number; orderNo: string } | null;
  createdAt: string;
};

const statusLabels: Record<string, string> = {
  draft: "草稿",
  sent: "已发送",
  accepted: "已接受",
  converted: "已转订单",
  rejected: "已拒绝",
};

const statusColors: Record<string, string> = {
  draft: "default",
  sent: "blue",
  accepted: "green",
  converted: "purple",
  rejected: "red",
};

export default function InquiriesPage() {
  const router = useRouter();
  const [items, setItems] = useState<QuoteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [convertingId, setConvertingId] = useState<number | null>(null);
  const [editing, setEditing] = useState<QuoteRecord | null>(null);
  const [form] = Form.useForm();

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/quotes?pageSize=50");
      const data = (await response.json()) as { items?: QuoteRecord[]; message?: string };
      if (!response.ok) throw new Error(data.message || "报价列表加载失败");
      setItems(data.items ?? []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "报价列表加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(loadQuotes);
  }, [loadQuotes]);

  async function convertQuote(quoteId: number) {
    setConvertingId(quoteId);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/convert-to-order`, { method: "POST" });
      const data = (await response.json()) as { item?: { id: number }; message?: string };
      if (!response.ok || !data.item) throw new Error(data.message || "转订单失败");
      message.success("报价已转为订单");
      router.push(`/orders/${data.item.id}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "转订单失败");
    } finally {
      setConvertingId(null);
    }
  }

  async function openEdit(row: QuoteRecord) {
    try {
      const response = await fetch(`/api/quotes/${row.id}`);
      const data = (await response.json()) as { item?: QuoteRecord; message?: string };
      if (!response.ok || !data.item) throw new Error(data.message || "报价详情加载失败");
      setEditing(data.item);
      form.setFieldsValue(data.item);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "报价详情加载失败");
    }
  }

  async function saveQuote() {
    if (!editing) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      const response = await fetch(`/api/quotes/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "报价保存失败");
      message.success("报价已保存");
      setEditing(null);
      form.resetFields();
      await loadQuotes();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "报价保存失败");
    } finally {
      setSaving(false);
    }
  }

  const columns: ColumnsType<QuoteRecord> = [
    { title: "报价单号", dataIndex: "quoteNo", fixed: "left", width: 160, render: (value: string) => <span className="font-medium">{value}</span> },
    { title: "询盘", width: 230, render: (_, row) => row.inquiry ? `${row.inquiry.inquiryNo} · ${row.inquiry.title}` : "-" },
    { title: "客户", width: 190, render: (_, row) => row.customer?.name ?? "-" },
    { title: "品牌", width: 110, render: (_, row) => row.brand?.name ?? "-" },
    { title: "店铺", width: 170, render: (_, row) => row.store?.name ?? "-" },
    { title: "金额", dataIndex: "totalAmount", align: "right", width: 130, render: (value, row) => moneyText(value, row.currency) },
    { title: "状态", dataIndex: "status", width: 110, render: (value) => <Tag color={statusColors[value] ?? "default"}>{statusLabels[value] ?? value}</Tag> },
    { title: "关联订单", width: 150, render: (_, row) => row.order ? <Button type="link" size="small" onClick={() => router.push(`/orders/${row.order?.id}`)}>{row.order.orderNo}</Button> : "-" },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 210,
      render: (_, row) => row.order || row.status === "converted" ? (
        <Button type="link" size="small" onClick={() => row.order && router.push(`/orders/${row.order.id}`)}>查看订单</Button>
      ) : (
        <Space size={0} className="whitespace-nowrap">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>编辑</Button>
          <Popconfirm title="确认将该报价单转为订单？" onConfirm={() => convertQuote(row.id)}>
            <Button type="link" size="small" icon={<ArrowRightOutlined />} loading={convertingId === row.id}>转订单</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <div>
        <Typography.Title level={3} className="!mb-1 !text-[var(--foreground)]">询盘报价</Typography.Title>
        <Typography.Text type="secondary">第一版先展示报价单，并支持报价转订单；完整询盘报价工作台后续扩展。</Typography.Text>
      </div>
      <Card styles={{ body: { padding: 0 } }}>
        <Table<QuoteRecord>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={items}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1290 }}
          locale={{ emptyText: <Empty description="暂无报价数据" /> }}
        />
      </Card>
      <Modal title={editing ? `编辑报价 ${editing.quoteNo}` : "编辑报价"} open={Boolean(editing)} width={720} confirmLoading={saving} onCancel={() => setEditing(null)} onOk={saveQuote} destroyOnHidden>
        <Form form={form} layout="vertical">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <Form.Item name="currency" label="币种"><Select options={["USD", "CNY", "EUR", "JPY", "GBP"].map((value) => ({ label: value, value }))} /></Form.Item>
            <Form.Item name="status" label="状态"><Select options={Object.entries(statusLabels).filter(([value]) => value !== "converted").map(([value, label]) => ({ label, value }))} /></Form.Item>
            <Form.Item name="productAmount" label="商品金额"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
            <Form.Item name="shippingFee" label="运费"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
            <Form.Item name="discountAmount" label="折扣"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
            <Form.Item name="taxAmount" label="税费"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
            <Form.Item name="otherFee" label="其他费用"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
            <Form.Item name="remark" label="备注" className="md:col-span-2"><Input.TextArea rows={3} /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
