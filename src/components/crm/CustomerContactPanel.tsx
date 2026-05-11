"use client";

import { DeleteOutlined, EditOutlined, PlusOutlined, StarOutlined } from "@ant-design/icons";
import { Button, Form, Input, Modal, Popconfirm, Space, Switch, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import type { CustomerContact } from "./crmOptions";

type Props = {
  customerId: number;
  contacts: CustomerContact[];
  onReload: () => Promise<void> | void;
};

export default function CustomerContactPanel({ customerId, contacts, onReload }: Props) {
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<CustomerContact | null>(null);

  async function saveContact() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/crm/contacts/${editing.id}` : `/api/crm/customers/${customerId}/contacts`, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "保存失败");
      message.success(editing ? "联系人已更新" : "联系人已新增");
      setOpen(false);
      setEditing(null);
      form.resetFields();
      await onReload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function setPrimary(contactId: number) {
    try {
      const response = await fetch(`/api/crm/contacts/${contactId}/set-primary`, { method: "POST" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "设置失败");
      message.success("已设置为主联系人");
      await onReload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "设置失败");
    }
  }

  async function deleteContact(contactId: number) {
    try {
      const response = await fetch(`/api/crm/contacts/${contactId}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "删除失败");
      message.success("联系人已删除");
      await onReload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  const columns: ColumnsType<CustomerContact> = [
    { title: "姓名", dataIndex: "name", width: 130 },
    { title: "职位", dataIndex: "position", width: 140, render: (value) => value || "-" },
    { title: "邮箱", dataIndex: "email", width: 190, render: (value) => value || "-" },
    { title: "电话", dataIndex: "phone", width: 140, render: (value) => value || "-" },
    { title: "WhatsApp", dataIndex: "whatsapp", width: 150, render: (value) => value || "-" },
    { title: "主联系人", dataIndex: "isPrimary", width: 110, render: (value) => value ? <Tag color="blue">主联系人</Tag> : "-" },
    { title: "备注", dataIndex: "remark", render: (value) => value || "-" },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 230,
      render: (_, row) => (
        <Space size={4}>
          {!row.isPrimary ? <Button type="link" size="small" icon={<StarOutlined />} onClick={() => setPrimary(row.id)}>设为主联系人</Button> : null}
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(row); form.setFieldsValue(row); setOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除联系人？" onConfirm={() => deleteContact(row.id)}>
            <Button danger type="link" size="small" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ isPrimary: contacts.length === 0 }); setOpen(true); }}>新增联系人</Button>
      </div>
      <Table<CustomerContact> rowKey="id" size="middle" columns={columns} dataSource={contacts} pagination={false} scroll={{ x: 1200 }} />
      <Modal title={editing ? "编辑联系人" : "新增联系人"} open={open} confirmLoading={saving} onCancel={() => setOpen(false)} onOk={saveContact} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="联系人姓名" rules={[{ required: true, message: "请输入联系人姓名" }]}><Input /></Form.Item>
          <Form.Item name="position" label="职位"><Input /></Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ type: "email", message: "邮箱格式不正确" }]}><Input /></Form.Item>
          <Form.Item name="phone" label="电话"><Input /></Form.Item>
          <Form.Item name="whatsapp" label="WhatsApp"><Input /></Form.Item>
          <Form.Item name="isPrimary" label="是否主联系人" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
