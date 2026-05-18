"use client";

import { ArrowLeftOutlined, PrinterOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Empty, Space, Spin, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { moneyText } from "@/components/orders/orderOptions";

type InquiryDetail = {
  id: number;
  inquiryNo: string;
  title: string;
  content?: string | null;
  status: string;
  countryCode?: string | null;
  customer?: { id: number; name: string; companyName?: string | null; countryCode?: string | null } | null;
  brand?: { id: number; name: string; code?: string | null } | null;
  platform?: { id: number; name: string; code?: string | null } | null;
  store?: { id: number; name: string; defaultCurrency?: string | null } | null;
  channel?: { id: number; businessLine: string; channelName: string } | null;
  quotes?: Array<{ id: number; quoteNo: string; status: string; totalAmount: number; currency: string; createdAt: string }>;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse = { item?: InquiryDetail; message?: string };

const inquiryStatusLabels: Record<string, string> = {
  new: "新询盘",
  quoted: "已报价",
  won: "已成交",
  lost: "已丢单",
  closed: "已关闭",
};

const quoteStatusLabels: Record<string, string> = {
  draft: "草稿",
  sent: "已发送",
  accepted: "已接受",
  converted: "已转订单",
  rejected: "已拒绝",
};

const statusColors: Record<string, string> = {
  new: "blue",
  quoted: "purple",
  won: "green",
  lost: "red",
  closed: "default",
  draft: "default",
  sent: "blue",
  accepted: "green",
  converted: "purple",
  rejected: "red",
};

function dateText(value?: string | null) {
  return value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-";
}

function customerName(inquiry?: InquiryDetail | null) {
  return inquiry?.customer?.companyName || inquiry?.customer?.name || "未关联客户";
}

export default function InquiryDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);

  const loadInquiry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/inquiries/${id}`);
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.item) throw new Error(data.message || "询盘详情加载失败");
      setInquiry(data.item);
    } catch (loadError) {
      const messageText = loadError instanceof Error ? loadError.message : "询盘详情加载失败";
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    queueMicrotask(loadInquiry);
  }, [loadInquiry]);

  const quoteColumns: ColumnsType<NonNullable<InquiryDetail["quotes"]>[number]> = [
    { title: "报价单号", dataIndex: "quoteNo", width: 170, render: (value, row) => <Link className="font-medium" href={`/quote-print/${row.id}`}>{value}</Link> },
    { title: "状态", dataIndex: "status", width: 110, render: (value: string) => <Tag color={statusColors[value] ?? "default"}>{quoteStatusLabels[value] ?? value}</Tag> },
    { title: "报价金额", width: 140, align: "right", render: (_, row) => moneyText(Number(row.totalAmount || 0), row.currency) },
    { title: "创建时间", dataIndex: "createdAt", width: 160, render: dateText },
    {
      title: "操作",
      width: 110,
      render: (_, row) => (
        <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => window.open(`/quote-print/${row.id}`, "_blank", "noopener,noreferrer")}>
          打印
        </Button>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <div className="page-section-header">
        <div>
          <Space className="mb-2">
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/inquiries")}>返回询盘报价</Button>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={loadInquiry}>刷新</Button>
          </Space>
          <Typography.Title level={3} className="!mb-1 !text-[var(--foreground)]">
            {inquiry?.title ?? `询盘详情 #${id}`}
          </Typography.Title>
          <Typography.Text type="secondary">{inquiry?.inquiryNo ?? "正在加载询盘信息"}</Typography.Text>
        </div>
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <Spin spinning={loading}>
        {inquiry ? (
          <div className="page-stack">
            <Card title="询盘信息">
              <Descriptions column={{ xs: 1, md: 2, xl: 3 }} bordered size="small">
                <Descriptions.Item label="询盘号">{inquiry.inquiryNo}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={statusColors[inquiry.status] ?? "default"}>{inquiryStatusLabels[inquiry.status] ?? inquiry.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="客户">{customerName(inquiry)}</Descriptions.Item>
                <Descriptions.Item label="国家">{inquiry.countryCode || inquiry.customer?.countryCode || "-"}</Descriptions.Item>
                <Descriptions.Item label="品牌">{inquiry.brand?.name ?? "-"}</Descriptions.Item>
                <Descriptions.Item label="平台">{inquiry.platform?.name ?? "-"}</Descriptions.Item>
                <Descriptions.Item label="店铺">{inquiry.store?.name ?? "-"}</Descriptions.Item>
                <Descriptions.Item label="渠道">{inquiry.channel ? `${inquiry.channel.businessLine} / ${inquiry.channel.channelName}` : "-"}</Descriptions.Item>
                <Descriptions.Item label="创建时间">{dateText(inquiry.createdAt)}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="询盘内容">
              {inquiry.content ? (
                <Typography.Paragraph className="whitespace-pre-wrap !mb-0">{inquiry.content}</Typography.Paragraph>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无询盘内容" />
              )}
            </Card>

            <Card title="关联报价">
              <Table
                rowKey="id"
                columns={quoteColumns}
                dataSource={inquiry.quotes ?? []}
                pagination={false}
                scroll={{ x: 720 }}
                locale={{ emptyText: <Empty description="暂无关联报价" /> }}
              />
            </Card>
          </div>
        ) : error ? null : (
          <Card>
            <Empty description="正在加载询盘详情" />
          </Card>
        )}
      </Spin>
    </div>
  );
}
