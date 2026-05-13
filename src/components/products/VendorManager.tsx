"use client";

import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";

export type VendorRecord = {
  id: number;
  name: string;
  vendorType?: string | null;
  type?: string | null;
  countryCode?: string | null;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  status: string;
  remark?: string | null;
};

type ListResponse<T> = { items: T[]; total: number; message?: string };
type Filters = { keyword?: string; vendorType?: string; status?: string };

const vendorTypeOptions = [
  { label: "供应商", value: "supplier" },
  { label: "物流商", value: "logistics" },
  { label: "服务商", value: "service" },
  { label: "其他", value: "other" },
];

function vendorTypeValue(row: VendorRecord) {
  return row.vendorType || row.type || "supplier";
}

function vendorTypeLabel(value?: string | null) {
  return vendorTypeOptions.find((item) => item.value === value)?.label ?? value ?? "-";
}

function query(filters: Filters) {
  const params = new URLSearchParams({ pageSize: "100" });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, String(value));
  });
  return params.toString();
}

export default function VendorManager({ onChanged }: { onChanged?: () => void }) {
  const [form] = Form.useForm();
  const [filters, setFilters] = useState<Filters>({});
  const [items, setItems] = useState<VendorRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VendorRecord | null>(null);

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/vendors?${query(filters)}`);
      const data = (await response.json()) as ListResponse<VendorRecord>;
      if (!response.ok) throw new Error(data.message || "供应商列表加载失败");
      setItems(data.items ?? []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "供应商列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    queueMicrotask(loadVendors);
  }, [loadVendors]);

  async function saveVendor() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/vendors/${editing.id}` : "/api/vendors", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "保存失败");
      message.success(editing ? "供应商已更新" : "供应商已新增");
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      await loadVendors();
      onChanged?.();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteVendor(id: number) {
    try {
      const response = await fetch(`/api/vendors/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "删除失败");
      message.success("供应商已删除");
      await loadVendors();
      onChanged?.();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  const columns: ColumnsType<VendorRecord> = [
    { title: "供应商名称", dataIndex: "name", fixed: "left", width: 220, render: (value) => <span className="font-medium">{value}</span> },
    { title: "类型", width: 110, render: (_, row) => <Tag color={vendorTypeValue(row) === "supplier" ? "blue" : vendorTypeValue(row) === "logistics" ? "cyan" : vendorTypeValue(row) === "service" ? "purple" : "default"}>{vendorTypeLabel(vendorTypeValue(row))}</Tag> },
    { title: "国家", dataIndex: "countryCode", width: 90, render: (value) => value || "-" },
    { title: "联系人", dataIndex: "contact", width: 130, render: (value) => value || "-" },
    { title: "邮箱", dataIndex: "email", width: 180, render: (value) => value || "-" },
    { title: "电话", dataIndex: "phone", width: 140, render: (value) => value || "-" },
    { title: "WhatsApp", dataIndex: "whatsapp", width: 150, render: (value) => value || "-" },
    { title: "网站", dataIndex: "website", width: 190, render: (value) => value || "-" },
    { title: "状态", dataIndex: "status", width: 90, render: (value) => <Tag color={value === "active" ? "green" : "default"}>{value === "active" ? "启用" : "停用"}</Tag> },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 150,
      render: (_, row) => (
        <Space size={0} className="whitespace-nowrap">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(row); form.setFieldsValue({ ...row, vendorType: vendorTypeValue(row) }); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除供应商？" onConfirm={() => deleteVendor(row.id)}>
            <Button danger type="link" size="small" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <Card styles={{ body: { padding: 16 } }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Space wrap>
            <Input allowClear prefix={<SearchOutlined />} placeholder="搜索供应商/联系人/邮箱" value={filters.keyword} style={{ width: 260 }} onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value || undefined }))} />
            <Select allowClear placeholder="类型" value={filters.vendorType} style={{ width: 130 }} options={vendorTypeOptions} onChange={(value) => setFilters((current) => ({ ...current, vendorType: value }))} />
            <Select allowClear placeholder="状态" value={filters.status} style={{ width: 120 }} options={[{ label: "启用", value: "active" }, { label: "停用", value: "inactive" }]} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} />
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => setFilters({})}>重置</Button>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ vendorType: "supplier", status: "active" }); setModalOpen(true); }}>新增供应商</Button>
        </div>
      </Card>
      <Card styles={{ body: { padding: 0 } }}>
        <Table<VendorRecord> rowKey="id" size="middle" loading={loading} columns={columns} dataSource={items} pagination={false} scroll={{ x: 1460 }} locale={{ emptyText: <Empty description="暂无供应商" /> }} />
      </Card>

      <Modal title={editing ? "编辑供应商" : "新增供应商"} open={modalOpen} width={780} confirmLoading={saving} onCancel={() => setModalOpen(false)} onOk={saveVendor} destroyOnHidden>
        <Form form={form} layout="vertical" initialValues={{ vendorType: "supplier", status: "active" }}>
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <Form.Item name="name" label="供应商名称" rules={[{ required: true, message: "请输入供应商名称" }]}><Input /></Form.Item>
            <Form.Item name="vendorType" label="类型"><Select options={vendorTypeOptions} /></Form.Item>
            <Form.Item name="countryCode" label="国家"><Input placeholder="如 CN / US" /></Form.Item>
            <Form.Item name="contact" label="联系人"><Input /></Form.Item>
            <Form.Item name="email" label="邮箱"><Input /></Form.Item>
            <Form.Item name="phone" label="电话"><Input /></Form.Item>
            <Form.Item name="whatsapp" label="WhatsApp"><Input /></Form.Item>
            <Form.Item name="website" label="网站"><Input /></Form.Item>
            <Form.Item name="status" label="状态"><Select options={[{ label: "启用", value: "active" }, { label: "停用", value: "inactive" }]} /></Form.Item>
            <Form.Item name="remark" label="备注" className="md:col-span-2"><Input.TextArea rows={3} /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
