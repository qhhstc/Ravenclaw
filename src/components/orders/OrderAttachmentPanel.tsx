"use client";

import { UploadOutlined } from "@ant-design/icons";
import { Button, Select, Space, Upload, message } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useCallback, useEffect, useState } from "react";
import AttachmentTable from "./AttachmentTable";
import { attachmentTypeOptions, type AttachmentRecord } from "./orderAttachmentOptions";

export default function OrderAttachmentPanel({ orderId }: { orderId: number }) {
  const [items, setItems] = useState<AttachmentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [attachmentType, setAttachmentType] = useState("other");

  const loadAttachments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/attachments`);
      const data = (await response.json()) as { items?: AttachmentRecord[]; message?: string };
      if (!response.ok) throw new Error(data.message || "附件加载失败");
      setItems(data.items ?? []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "附件加载失败");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    queueMicrotask(loadAttachments);
  }, [loadAttachments]);

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("attachmentType", attachmentType);
    setUploading(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/attachments`, { method: "POST", body: formData });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "上传失败");
      message.success("附件已上传");
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
    <div>
      <Space className="mb-4" wrap>
        <Select value={attachmentType} options={attachmentTypeOptions} style={{ width: 160 }} onChange={setAttachmentType} />
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
          <Button loading={uploading} icon={<UploadOutlined />}>上传附件</Button>
        </Upload>
      </Space>
      <AttachmentTable items={items} loading={loading} onDelete={deleteAttachment} />
    </div>
  );
}
