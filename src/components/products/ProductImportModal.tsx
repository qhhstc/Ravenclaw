"use client";

import { InboxOutlined } from "@ant-design/icons";
import { Alert, Button, Descriptions, Empty, Modal, Space, Table, Upload, message } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useState } from "react";

type PreviewRow = {
  rowNumber: number;
  valid: boolean;
  errors: string[];
  data: Record<string, unknown>;
  summary: string;
};

type PreviewResponse = {
  totalRows: number;
  successRows: number;
  failedRows: number;
  rows: PreviewRow[];
  message?: string;
};

type Props = {
  open: boolean;
  onCancel: () => void;
  onImported: () => void;
};

export default function ProductImportModal({ open, onCancel, onImported }: Props) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function previewFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      const response = await fetch("/api/products/import/preview", { method: "POST", body: formData });
      const data = (await response.json()) as PreviewResponse;
      if (!response.ok) throw new Error(data.message || "解析失败");
      setPreview(data);
      message.success("产品文件解析完成");
    } catch (error) {
      setPreview(null);
      message.error(error instanceof Error ? error.message : "解析失败");
    } finally {
      setUploading(false);
    }
  }

  async function confirmImport() {
    const rows = preview?.rows.filter((row) => row.valid).map((row) => ({ ...row.data, rowNumber: row.rowNumber })) ?? [];
    if (!rows.length) {
      message.warning("没有可导入的数据");
      return;
    }
    setConfirming(true);
    try {
      const response = await fetch("/api/products/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = (await response.json()) as { successRows?: number; failedRows?: number; message?: string };
      if (!response.ok) throw new Error(data.message || "导入失败");
      message.success(`导入完成：成功 ${data.successRows ?? 0} 行，失败 ${data.failedRows ?? 0} 行`);
      setFileList([]);
      setPreview(null);
      onImported();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导入失败");
    } finally {
      setConfirming(false);
    }
  }

  const errorRows = preview?.rows.filter((row) => !row.valid) ?? [];

  return (
    <Modal
      title="导入产品 Excel"
      open={open}
      width={860}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>取消</Button>,
        <Button key="confirm" type="primary" loading={confirming} disabled={!preview?.successRows} onClick={confirmImport}>确认导入</Button>,
      ]}
      destroyOnHidden
    >
      <Upload.Dragger
        accept=".xlsx"
        maxCount={1}
        fileList={fileList}
        beforeUpload={(file) => {
          if (!file.name.toLowerCase().endsWith(".xlsx")) {
            message.error("仅支持 .xlsx 文件");
            return Upload.LIST_IGNORE;
          }
          if (file.size > 10 * 1024 * 1024) {
            message.error("文件不能超过 10MB");
            return Upload.LIST_IGNORE;
          }
          setFileList([file]);
          void previewFile(file);
          return false;
        }}
        onRemove={() => {
          setFileList([]);
          setPreview(null);
        }}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">点击或拖拽产品导入模板到这里</p>
        <p className="ant-upload-hint">仅支持 .xlsx，系统会先解析预览，不会立即写入数据库。</p>
      </Upload.Dragger>

      {uploading ? <Alert className="mt-4" type="info" showIcon message="正在解析 Excel..." /> : null}

      {preview ? (
        <div className="mt-4 space-y-4">
          <Descriptions bordered size="small" column={3}>
            <Descriptions.Item label="总行数">{preview.totalRows}</Descriptions.Item>
            <Descriptions.Item label="可导入">{preview.successRows}</Descriptions.Item>
            <Descriptions.Item label="错误行">{preview.failedRows}</Descriptions.Item>
          </Descriptions>
          <Table<PreviewRow>
            rowKey="rowNumber"
            size="small"
            dataSource={errorRows}
            pagination={false}
            locale={{ emptyText: <Empty description="没有错误行" /> }}
            columns={[
              { title: "行号", dataIndex: "rowNumber", width: 90 },
              { title: "错误原因", dataIndex: "errors", width: 260, render: (errors: string[]) => errors.join("；") },
              { title: "原始数据摘要", dataIndex: "summary" },
            ]}
          />
          <Space>
            <Alert type="success" showIcon message="SKU 重复时会按 SKU 更新已有产品。" />
          </Space>
        </div>
      ) : null}
    </Modal>
  );
}
