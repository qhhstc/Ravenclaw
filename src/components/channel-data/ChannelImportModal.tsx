"use client";

import { InboxOutlined } from "@ant-design/icons";
import { Alert, Button, Descriptions, Modal, Space, Table, Upload, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadProps } from "antd";
import { useState } from "react";
import type { ChannelDataFilters } from "./channelDataTypes";

export type ChannelImportPreviewRow = {
  rowNumber: number;
  sourceType?: "standard" | "customer_original";
  businessBlock: string;
  businessLine: string;
  brandName: string;
  platformName: string;
  storeName: string;
  channelName: string;
  decisionOwner: string;
  year: number;
  month: number;
  weeks: Array<{ weekNumber: number; salesAmountOriginal: number; adSpendOriginal: number }>;
  manualRating: string;
  manualActionSuggestion: string;
  decisionDeadline: string;
  remark: string;
  rawSummary: string;
};

export type ChannelImportErrorRow = {
  rowNumber: number;
  errors: string[];
  rawSummary: string;
};

type ChannelImportPreview = {
  fileName: string;
  sourceType: "standard" | "customer_original";
  importYear?: number;
  importMonth?: number;
  weekMappings: Array<{ sourceLabel: string; weekNumber: number }>;
  totalRows: number;
  validRows: ChannelImportPreviewRow[];
  errorRows: ChannelImportErrorRow[];
};

type ChannelImportModalProps = {
  open: boolean;
  filters: ChannelDataFilters;
  onClose: () => void;
  onImported: (filters?: Pick<ChannelDataFilters, "year" | "month">) => Promise<void> | void;
};

const maxFileSize = 10 * 1024 * 1024;

export default function ChannelImportModal({ open, filters, onClose, onImported }: ChannelImportModalProps) {
  const [preview, setPreview] = useState<ChannelImportPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);

  async function previewFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      message.error("仅支持 .xlsx 文件");
      return Upload.LIST_IGNORE;
    }
    if (file.size > maxFileSize) {
      message.error("文件不能超过 10MB");
      return Upload.LIST_IGNORE;
    }

    setPreviewing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("year", String(filters.year));
      formData.append("month", String(filters.month));
      const response = await fetch("/api/channel-data/import/preview", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as ChannelImportPreview & { message?: string };
      if (!response.ok) throw new Error(data.message || "解析失败");
      setPreview(data);
      message.success("解析完成，请确认预览结果");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "解析失败");
    } finally {
      setPreviewing(false);
    }

    return false;
  }

  async function confirmImport() {
    if (!preview || preview.validRows.length === 0) return;
    setImporting(true);
    try {
      const response = await fetch("/api/channel-data/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: preview.fileName,
          rows: preview.validRows,
          previewFailedRows: preview.errorRows.length,
          previewTotalRows: preview.totalRows,
        }),
      });
      const data = (await response.json()) as { message?: string; successRows?: number; failedRows?: number };
      if (!response.ok) throw new Error(data.message || "导入失败");
      message.success(`导入完成：成功 ${data.successRows ?? 0} 行，失败 ${data.failedRows ?? 0} 行`);
      const latestImportedRow = [...preview.validRows].sort((a, b) => a.year - b.year || a.month - b.month).at(-1);
      setPreview(null);
      onClose();
      await onImported(latestImportedRow ? { year: latestImportedRow.year, month: latestImportedRow.month } : undefined);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导入失败");
    } finally {
      setImporting(false);
    }
  }

  const errorColumns: ColumnsType<ChannelImportErrorRow> = [
    { title: "行号", dataIndex: "rowNumber", width: 90 },
    { title: "错误原因", dataIndex: "errors", width: 260, render: (errors: string[]) => errors.join("；") },
    { title: "原始数据摘要", dataIndex: "rawSummary", render: (value) => value || "-" },
  ];

  const uploadProps: UploadProps = {
    accept: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    maxCount: 1,
    showUploadList: false,
    beforeUpload: previewFile,
  };

  return (
    <Modal
      title="导入渠道数据 Excel"
      open={open}
      width={860}
      onCancel={() => {
        setPreview(null);
        onClose();
      }}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" disabled={!preview?.validRows.length} loading={importing} onClick={confirmImport}>
            确认导入
          </Button>
        </Space>
      }
      destroyOnHidden
    >
      <Upload.Dragger {...uploadProps} className="mb-4">
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">点击或拖拽 .xlsx 文件到此区域上传</p>
        <p className="ant-upload-hint">上传后仅解析预览，不会立即写入数据库。文件大小限制 10MB。</p>
      </Upload.Dragger>

      {previewing ? <Alert showIcon type="info" message="正在解析 Excel，请稍候..." className="mb-4" /> : null}

      {preview ? (
        <div className="space-y-4">
          {(() => {
            const months = Array.from(new Set(preview.validRows.map((row) => `${row.year}-${String(row.month).padStart(2, "0")}`))).sort();
            const detectedMonth = months.length ? months.join("、") : preview.importYear && preview.importMonth ? `${preview.importYear}-${String(preview.importMonth).padStart(2, "0")}` : `${filters.year}-${String(filters.month).padStart(2, "0")}`;
            return (
          <Descriptions bordered size="small" column={4}>
            <Descriptions.Item label="总行数">{preview.totalRows}</Descriptions.Item>
            <Descriptions.Item label="可导入行数">{preview.validRows.length}</Descriptions.Item>
            <Descriptions.Item label="错误行数">{preview.errorRows.length}</Descriptions.Item>
            <Descriptions.Item label="文件名">{preview.fileName}</Descriptions.Item>
            <Descriptions.Item label="识别类型">{preview.sourceType === "customer_original" ? "客户原渠道效率表" : "系统标准模板"}</Descriptions.Item>
            <Descriptions.Item label="导入月份">{detectedMonth}</Descriptions.Item>
            <Descriptions.Item label="周段映射" span={2}>
              {preview.weekMappings.length ? preview.weekMappings.map((item) => `${item.sourceLabel} → W${item.weekNumber}`).join("；") : "按 W1-W5 表头导入"}
            </Descriptions.Item>
          </Descriptions>
            );
          })()}

          {preview.errorRows.length ? (
            <Table<ChannelImportErrorRow>
              size="small"
              rowKey={(row) => String(row.rowNumber)}
              columns={errorColumns}
              dataSource={preview.errorRows}
              pagination={{ pageSize: 5 }}
              scroll={{ x: 720 }}
            />
          ) : (
            <Alert showIcon type="success" message="没有发现错误行，可以确认导入。" />
          )}
        </div>
      ) : null}
    </Modal>
  );
}
