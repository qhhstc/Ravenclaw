"use client";

import { UploadOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Form, Input, Select, Space, Timeline, Typography, Upload, message } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useCallback, useEffect, useState } from "react";
import AttachmentTable from "./AttachmentTable";
import { attachmentTypeOptions, type AttachmentRecord } from "./orderAttachmentOptions";
import { formatDateTime, optionLabel, orderStatusOptions, type OrderStatusLogRecord } from "./orderOptions";

type Props = {
  orderId: number;
  currentStatus: string;
  logs: OrderStatusLogRecord[];
  canWrite: boolean;
  onChanged: () => Promise<void> | void;
};

function StatusLogAttachments({ logId, canWrite }: { logId: number; canWrite: boolean }) {
  const [items, setItems] = useState<AttachmentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [attachmentType, setAttachmentType] = useState("other");

  const loadAttachments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/orders/status-logs/${logId}/attachments`);
      const data = (await response.json()) as { items?: AttachmentRecord[]; message?: string };
      if (!response.ok) throw new Error(data.message || "状态附件加载失败");
      setItems(data.items ?? []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "状态附件加载失败");
    } finally {
      setLoading(false);
    }
  }, [logId]);

  useEffect(() => {
    queueMicrotask(loadAttachments);
  }, [loadAttachments]);

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("attachmentType", attachmentType);
    setUploading(true);
    try {
      const response = await fetch(`/api/orders/status-logs/${logId}/attachments`, { method: "POST", body: formData });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "上传失败");
      message.success("状态附件已上传");
      setFileList([]);
      await loadAttachments();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function deleteAttachment(id: number) {
    try {
      const response = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "删除失败");
      message.success("附件已删除");
      await loadAttachments();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-[#edf0f5] bg-white p-3">
      {canWrite ? (
        <Space className="mb-3" wrap>
          <Select value={attachmentType} options={attachmentTypeOptions} style={{ width: 150 }} onChange={setAttachmentType} />
          <Upload
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt,.zip"
            maxCount={1}
            fileList={fileList}
            beforeUpload={(file) => {
              if (file.size > 10 * 1024 * 1024) {
                message.error("附件不能超过 10MB");
                return Upload.LIST_IGNORE;
              }
              setFileList([file]);
              void uploadFile(file);
              return false;
            }}
            onRemove={() => setFileList([])}
          >
            <Button size="small" loading={uploading} icon={<UploadOutlined />}>上传本状态附件</Button>
          </Upload>
        </Space>
      ) : null}
      <AttachmentTable items={items} loading={loading} onDelete={canWrite ? deleteAttachment : undefined} emptyText="暂无状态附件" />
    </div>
  );
}

export default function OrderStatusLogPanel({ orderId, currentStatus, logs, canWrite, onChanged }: Props) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  async function updateStatus() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/status-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "状态更新失败");
      message.success("订单状态已更新");
      form.resetFields();
      form.setFieldsValue({ toStatus: values.toStatus });
      await onChanged();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "状态更新失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {canWrite ? (
        <Card className="mb-4" styles={{ body: { padding: 16 } }}>
          <Form form={form} layout="vertical" initialValues={{ toStatus: currentStatus }}>
            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-[220px_1fr_auto] md:items-end">
              <Form.Item name="toStatus" label="更新订单状态" rules={[{ required: true, message: "请选择订单状态" }]}>
                <Select options={orderStatusOptions.map(({ label, value }) => ({ label, value }))} />
              </Form.Item>
              <Form.Item name="remark" label="状态备注">
                <Input.TextArea rows={1} autoSize={{ minRows: 1, maxRows: 4 }} placeholder="例如：客户已确认尾款 / 提单已出 / 报关资料已提交 / WhatsApp 确认记录" />
              </Form.Item>
              <Form.Item label=" ">
                <Button type="primary" loading={saving} onClick={updateStatus}>保存状态记录</Button>
              </Form.Item>
            </div>
          </Form>
          <Typography.Text type="secondary">保存后会生成一条状态记录；每条记录下方可上传提单、装箱单、报关单、聊天记录等附件。</Typography.Text>
        </Card>
      ) : null}

      {!logs.length ? <Empty description="暂无状态记录" /> : (
        <Timeline
          items={logs.map((log) => ({
            children: (
              <div>
                <div className="font-medium text-[#172033]">
                  {log.fromStatus ? `${optionLabel(orderStatusOptions, log.fromStatus)} → ` : ""}
                  {optionLabel(orderStatusOptions, log.toStatus)}
                </div>
                <div className="text-sm text-[#667085]">{formatDateTime(log.createdAt)} · {log.creator?.name ?? "系统"}</div>
                {log.remark ? <Typography.Paragraph className="!mb-0 !mt-2 whitespace-pre-wrap rounded-lg bg-[#fafcff] p-3">{log.remark}</Typography.Paragraph> : null}
                <StatusLogAttachments logId={log.id} canWrite={canWrite} />
              </div>
            ),
          }))}
        />
      )}
    </div>
  );
}
