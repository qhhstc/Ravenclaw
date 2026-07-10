"use client";

import { ArrowLeftOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Input, Modal, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchJson, runStatusMeta, type RunRecord } from "./shared";

type ListResponse = { items: RunRecord[]; total: number; page: number; pageSize: number };
type RecentRun = { id: number; websiteDomain: string | null; brandName: string | null; candidateCount: number; createdAt: string };

// 从用户输入粗解析域名(去 www./小写,与后端 canonicalDomain 对齐;后端会再次归一化,前端只为少发无效请求)
function parseDomain(input: string): string | null {
  try {
    const withProtocol = /^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`;
    return new URL(withProtocol).hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  } catch {
    return null;
  }
}

export default function DiscoveryListPage({ youtubeConfigured }: { youtubeConfigured: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<RunRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson<ListResponse>(`/api/influencers/discovery-runs?page=${page}&pageSize=${pageSize}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    queueMicrotask(loadData);
  }, [loadData]);

  useEffect(() => {
    queueMicrotask(async () => {
      try {
        const data = await fetchJson<{ user?: { role?: string } }>("/api/auth/me");
        setCanEdit(["admin", "sales"].includes(data.user?.role ?? ""));
      } catch {
        setCanEdit(false);
      }
    });
  }, []);

  async function doCreate() {
    setCreating(true);
    try {
      const { item } = await fetchJson<{ item: RunRecord }>("/api/influencers/discovery-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl: url.trim() }),
      });
      message.success("分析任务已创建");
      setUrl("");
      router.push(`/influencers/discovery/${item.id}?autoAnalyze=1`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  async function startAnalysis() {
    if (!url.trim()) {
      message.warning("请输入网站地址");
      return;
    }
    // 创建前检查同 domain 近 7 天是否已有 completed run,避免重复消耗 AI/YouTube
    const domain = parseDomain(url);
    if (domain) {
      try {
        const { item: recent } = await fetchJson<{ item: RecentRun | null }>(`/api/influencers/discovery-runs/recent?domain=${encodeURIComponent(domain)}`);
        if (recent) {
          Modal.confirm({
            title: "该网站近期已有分析结果",
            content: `${domain} 在近 7 天内已分析过（候选红人 ${recent.candidateCount} 个）。可直接查看上次结果，或重新分析（会再次消耗 AI 与 YouTube API）。`,
            okText: "仍要重新分析",
            cancelText: "查看上次结果",
            onOk: () => doCreate(),
            onCancel: () => router.push(`/influencers/discovery/${recent.id}`),
          });
          return;
        }
      } catch {
        // 查询失败不阻断创建
      }
    }
    await doCreate();
  }

  const columns: ColumnsType<RunRecord> = [
    {
      title: "网站",
      dataIndex: "websiteUrl",
      render: (value, row) => <Link href={`/influencers/discovery/${row.id}`}>{row.brandName || value}</Link>,
    },
    { title: "域名", dataIndex: "websiteDomain", width: 180, render: (v) => v ?? "-" },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (value: string) => <Tag color={runStatusMeta[value]?.color ?? "default"}>{runStatusMeta[value]?.label ?? value}</Tag>,
    },
    { title: "候选数", dataIndex: "candidateCount", width: 90, align: "right" },
    { title: "创建人", dataIndex: ["createdBy", "name"], width: 110, render: (_, row) => row.createdBy?.name ?? "-" },
    { title: "创建时间", dataIndex: "createdAt", width: 170, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: "操作",
      width: 90,
      render: (_, row) => <Button type="link" size="small" onClick={() => router.push(`/influencers/discovery/${row.id}`)}>查看</Button>,
    },
  ];

  return (
    <div className="page-stack">
      <div className="page-section-header">
        <div>
          <Space align="center">
            <Link href="/influencers"><Button icon={<ArrowLeftOutlined />} type="text" /></Link>
            <Typography.Title level={3} className="!mb-1 !text-[var(--foreground)]">红人发现</Typography.Title>
          </Space>
          <Typography.Text type="secondary">输入品牌官网，AI 分析网站生成品牌/红人画像与推荐搜索关键词，再导入并评分候选红人。</Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>刷新</Button>
          <Button onClick={() => router.push("/influencers/candidates")}>候选红人库</Button>
        </Space>
      </div>

      {!youtubeConfigured ? (
        <Alert
          type="warning"
          showIcon
          message="未配置第三方数据源"
          description="当前未配置 YOUTUBE_API_KEY，暂不支持自动拉取红人数据。V1 可通过 AI 生成的推荐关键词在各平台手动检索，再用 CSV 导入候选红人。"
        />
      ) : null}

      <Card>
        <Space.Compact style={{ width: "100%" }}>
          <Input
            size="large"
            prefix={<SearchOutlined />}
            placeholder="输入品牌官网，如 https://bahomu.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPressEnter={startAnalysis}
            disabled={!canEdit}
          />
          <Button size="large" type="primary" loading={creating} onClick={startAnalysis} disabled={!canEdit}>
            开始分析
          </Button>
        </Space.Compact>
        {!canEdit ? <Typography.Text type="secondary" className="mt-2 block text-xs">当前角色为只读，无法创建分析任务。</Typography.Text> : null}
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<RunRecord>
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>
    </div>
  );
}
