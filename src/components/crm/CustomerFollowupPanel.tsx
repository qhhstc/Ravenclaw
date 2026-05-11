"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, DatePicker, Empty, Form, Input, Modal, Popconfirm, Select, Space, Timeline, Typography, message } from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { followupTypeOptions, formatDateTime, optionLabel, type CustomerFollowup } from "./crmOptions";

type Props = {
  customerId: number;
  followups: CustomerFollowup[];
  onReload: () => Promise<void> | void;
};

export default function CustomerFollowupPanel({ customerId, followups, onReload }: Props) {
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function saveFollowup() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const response = await fetch(`/api/crm/customers/${customerId}/followups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          nextFollowupAt: values.nextFollowupAt ? (values.nextFollowupAt as dayjs.Dayjs).toISOString() : null,
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "保存失败");
      message.success("跟进记录已新增");
      setOpen(false);
      form.resetFields();
      await onReload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteFollowup(id: number) {
    try {
      const response = await fetch(`/api/crm/followups/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "删除失败");
      message.success("跟进记录已删除");
      await onReload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ followupType: "email" }); setOpen(true); }}>新增跟进记录</Button>
      </div>
      {followups.length ? (
        <Timeline
          items={followups.map((item) => ({
            color: item.nextFollowupAt ? "blue" : "gray",
            children: (
              <div className="rounded-xl border border-[#edf0f5] bg-white p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <Space>
                    <Typography.Text strong>{optionLabel(followupTypeOptions, item.followupType)}</Typography.Text>
                    <Typography.Text type="secondary">{formatDateTime(item.createdAt)}</Typography.Text>
                    <Typography.Text type="secondary">跟进人：{item.owner?.name ?? "-"}</Typography.Text>
                  </Space>
                  <Popconfirm title="确认删除该跟进记录？" onConfirm={() => deleteFollowup(item.id)}>
                    <Button danger type="link" size="small" icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </div>
                <div className="whitespace-pre-wrap text-[#344054]">{item.content}</div>
                {item.result ? <div className="mt-2 rounded-lg bg-[#f8fafc] p-3 text-[#667085]">结果：{item.result}</div> : null}
                <div className="mt-2 text-sm text-[#667085]">下次跟进：{formatDateTime(item.nextFollowupAt)}</div>
              </div>
            ),
          }))}
        />
      ) : <Empty description="暂无跟进记录" />}

      <Modal title="新增跟进记录" open={open} confirmLoading={saving} onCancel={() => setOpen(false)} onOk={saveFollowup} destroyOnHidden>
        <Form form={form} layout="vertical" initialValues={{ followupType: "email" }}>
          <Form.Item name="followupType" label="跟进方式" rules={[{ required: true }]}><Select options={followupTypeOptions} /></Form.Item>
          <Form.Item name="content" label="跟进内容" rules={[{ required: true, message: "请输入跟进内容" }]}><Input.TextArea rows={4} /></Form.Item>
          <Form.Item name="result" label="跟进结果"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="nextFollowupAt" label="下次跟进时间"><DatePicker showTime className="w-full" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
