"use client";

import { DeleteOutlined } from "@ant-design/icons";
import { Button, Empty, Popconfirm, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { attachmentTypeLabel, fileSizeText, type AttachmentRecord } from "./orderAttachmentOptions";
import { formatDateTime } from "./orderOptions";

type Props = {
  items: AttachmentRecord[];
  loading?: boolean;
  onDelete?: (id: number) => void;
  emptyText?: string;
};

export default function AttachmentTable({ items, loading, onDelete, emptyText = "暂无附件" }: Props) {
  const columns: ColumnsType<AttachmentRecord> = [
    { title: "附件名称", dataIndex: "fileName", width: 280, render: (value, row) => <a href={row.fileUrl} target="_blank" rel="noreferrer">{value}</a> },
    { title: "类型", dataIndex: "attachmentType", width: 130, render: attachmentTypeLabel },
    { title: "大小", dataIndex: "fileSize", width: 100, align: "right", render: fileSizeText },
    { title: "上传人", width: 120, render: (_, row) => row.uploader?.name ?? "-" },
    { title: "上传时间", dataIndex: "createdAt", width: 150, render: formatDateTime },
    {
      title: "操作",
      key: "actions",
      width: 90,
      render: (_, row) => onDelete ? (
        <Popconfirm title="确认删除附件？" onConfirm={() => onDelete(row.id)}>
          <Button danger type="link" size="small" icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      ) : null,
    },
  ];

  return <Table<AttachmentRecord> rowKey="id" loading={loading} columns={columns} dataSource={items} pagination={false} scroll={{ x: 880 }} locale={{ emptyText: <Empty description={emptyText} /> }} />;
}
