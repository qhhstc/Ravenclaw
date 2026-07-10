"use client";

import { InboxOutlined } from "@ant-design/icons";
import { Alert, Button, Descriptions, Empty, Modal, Table, Upload, message } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useState } from "react";

type PreviewRow = { rowNumber: number; valid: boolean; errors: string[]; summary: string };
type PreviewResponse = { totalRows: number; successRows: number; failedRows: number; rows: PreviewRow[]; message?: string };

type Props = {
  open: boolean;
  discoveryRunId?: number | null;
  onCancel: () => void;
  onImported: () => void;
};

// CSV 导入:preview 与 confirm 都提交原始文件,后端各自重新解析校验(confirm 不信任前端行)。
export default function CandidateImportModal({ open, discoveryRunId, onCancel, onImported }: Props) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function reset() {
    setFileList([]);
    setRawFile(null);
    setPreview(null);
  }

  async function previewFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      const response = await fetch("/api/influencers/candidates/import/preview", { method: "POST", body: formData });
      const data = (await response.json()) as PreviewResponse;
      if (!response.ok) throw new Error(data.message || "解析失败");
      setPreview(data);
      setRawFile(file);
      message.success("CSV 解析完成");
    } catch (error) {
      setPreview(null);
      setRawFile(null);
      message.error(error instanceof Error ? error.message : "解析失败");
    } finally {
      setUploading(false);
    }
  }

  async function confirmImport() {
    if (!rawFile) return;
    const formData = new FormData();
    formData.append("file", rawFile); // 重新提交原始文件,后端重新解析
    if (discoveryRunId) formData.append("discoveryRunId", String(discoveryRunId));
    setConfirming(true);
    try {
      const response = await fetch("/api/influencers/candidates/import/confirm", { method: "POST", body: formData });
      const data = (await response.json()) as { successRows?: number; failedRows?: number; message?: string };
      if (!response.ok) throw new Error(data.message || "导入失败");
      message.success(`导入完成：成功 ${data.successRows ?? 0} 行，跳过 ${data.failedRows ?? 0} 行`);
      reset();
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
      title="CSV 导入候选红人"
      open={open}
      width={820}
      onCancel={() => {
        reset();
        onCancel();
      }}
      footer={[
        <Button key="cancel" onClick={() => { reset(); onCancel(); }}>取消</Button>,
        <Button key="confirm" type="primary" loading={confirming} disabled={!preview?.successRows} onClick={confirmImport}>
          确认导入
        </Button>,
      ]}
      destroyOnHidden
    >
      <Upload.Dragger
        accept=".csv"
        maxCount={1}
        fileList={fileList}
        beforeUpload={(file) => {
          if (!file.name.toLowerCase().endsWith(".csv")) {
            message.error("仅支持 .csv 文件");
            return Upload.LIST_IGNORE;
          }
          if (file.size > 5 * 1024 * 1024) {
            message.error("文件不能超过 5MB");
            return Upload.LIST_IGNORE;
          }
          setFileList([file]);
          void previewFile(file);
          return false;
        }}
        onRemove={reset}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">点击或拖拽 CSV 文件到这里</p>
        <p className="ant-upload-hint">支持列（中英文）：platform, handle, profileUrl, email, country, followers, avgViews, engagementRate, nicheTags</p>
      </Upload.Dragger>

      {uploading ? <Alert className="mt-4" type="info" showIcon message="正在解析 CSV..." /> : null}

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
              { title: "行号", dataIndex: "rowNumber", width: 80 },
              { title: "错误原因", dataIndex: "errors", width: 300, render: (errors: string[]) => errors.join("；") },
              { title: "原始数据摘要", dataIndex: "summary" },
            ]}
          />
          <Alert type="success" showIcon message="确认导入时系统会重新解析原始文件，仅写入有效行。" />
        </div>
      ) : null}
    </Modal>
  );
}
