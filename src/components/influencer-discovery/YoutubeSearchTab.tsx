"use client";

import { SearchOutlined, YoutubeOutlined } from "@ant-design/icons";
import { Alert, AutoComplete, Button, Card, Empty, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { fetchJson, shortNumber, type RunRecord } from "./shared";

// 与后端 ExternalCandidatePreview 对齐(前端展示用子集)
export type ExternalPreview = {
  platform: "youtube";
  externalId?: string;
  handle?: string | null;
  displayName?: string | null;
  profileUrl?: string | null;
  country?: string | null;
  followers?: number | null;
  avgViews?: number | null;
  avgLikes?: number | null;
  avgComments?: number | null;
  recentPostCount?: number | null;
  engagementRate?: number | null;
  matchedKeywords?: string[];
  contentSamples?: Array<{ title?: string; url?: string }>;
  rawData?: unknown;
};

type SearchResponse = { items: ExternalPreview[]; enabled?: boolean; error?: string };
type ImportResponse = { created: number; skipped: number };

type Props = {
  runId: number;
  run: RunRecord | null;
  youtubeEnabled: boolean;
  canEdit: boolean;
  onImported: () => void;
};

export default function YoutubeSearchTab({ runId, run, youtubeEnabled, canEdit, onImported }: Props) {
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [items, setItems] = useState<ExternalPreview[]>([]);
  const [searched, setSearched] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);

  // 关键词候选:run 的 keywords + creatorNiches
  const keywordOptions = useMemo(() => {
    const kw = run?.keywordsJson ?? {};
    const pool = [...(Array.isArray(kw.keywords) ? kw.keywords : []), ...(Array.isArray(kw.creatorNiches) ? kw.creatorNiches : [])];
    return [...new Set(pool)].filter(Boolean).map((v) => ({ value: v }));
  }, [run]);

  async function runSearch() {
    if (!keyword.trim()) {
      message.warning("请输入搜索关键词");
      return;
    }
    setSearching(true);
    try {
      const data = await fetchJson<SearchResponse>(`/api/influencers/discovery-runs/${runId}/sources/youtube/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });
      setItems(data.items);
      setSearched(true);
      setSelectedKeys(data.items.map((it) => it.externalId ?? it.profileUrl ?? "").filter(Boolean));
      if (data.items.length === 0) message.info("未找到匹配的 YouTube 创作者");
    } catch (error) {
      setItems([]);
      setSearched(true);
      message.error(error instanceof Error ? error.message : "YouTube 搜索失败");
    } finally {
      setSearching(false);
    }
  }

  async function importSelected() {
    const selected = items.filter((it) => selectedKeys.includes(it.externalId ?? it.profileUrl ?? ""));
    if (!selected.length) {
      message.warning("请先勾选要导入的候选红人");
      return;
    }
    setImporting(true);
    try {
      const data = await fetchJson<ImportResponse>(`/api/influencers/discovery-runs/${runId}/sources/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: selected }),
      });
      message.success(`导入完成：新增 ${data.created} 个，跳过 ${data.skipped} 个`);
      onImported();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导入失败");
    } finally {
      setImporting(false);
    }
  }

  const columns: ColumnsType<ExternalPreview> = [
    { title: "平台", dataIndex: "platform", width: 90, render: () => <Tag color="red">YouTube</Tag> },
    {
      title: "频道/名称",
      dataIndex: "displayName",
      render: (_, row) => (
        <div>
          <div className="font-medium">{row.displayName || row.handle || row.externalId}</div>
          {row.handle && row.handle !== row.displayName ? <div className="text-xs text-[var(--muted)]">{row.handle}</div> : null}
        </div>
      ),
    },
    { title: "粉丝", dataIndex: "followers", width: 90, align: "right", render: shortNumber },
    { title: "估算均播", dataIndex: "avgViews", width: 100, align: "right", render: shortNumber },
    { title: "样本视频", dataIndex: "recentPostCount", width: 90, align: "right", render: (v) => v ?? "-" },
    {
      title: "匹配关键词",
      dataIndex: "matchedKeywords",
      width: 160,
      render: (v: string[] | undefined) => (v?.length ? <Space wrap size={2}>{v.map((k) => <Tag key={k}>{k}</Tag>)}</Space> : "-"),
    },
    {
      title: "主页",
      dataIndex: "profileUrl",
      width: 90,
      render: (v: string | null | undefined) => (v ? <a href={v} target="_blank" rel="noreferrer">打开</a> : "-"),
    },
  ];

  if (!youtubeEnabled) {
    return (
      <Card>
        <Alert
          type="warning"
          showIcon
          message="未配置 YouTube API"
          description="当前未启用或未配置 YouTube 数据源（需 YOUTUBE_API_ENABLED=true 且 YOUTUBE_API_KEY 非空）。可先用推荐关键词在平台手动检索后通过 CSV 导入。"
        />
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <Alert type="info" showIcon message="这里用于补充搜索。系统分析网站后会自动搜索一批 YouTube 候选红人；如需扩展关键词，可在此手动搜索并导入，导入后到候选红人执行评分。" />
      <Space.Compact style={{ width: "100%", maxWidth: 640 }}>
        <AutoComplete
          style={{ width: "100%" }}
          options={keywordOptions}
          value={keyword}
          onChange={setKeyword}
          filterOption={(input, option) => (option?.value ?? "").toLowerCase().includes(input.toLowerCase())}
          placeholder="选择或输入关键词，如 Genshin figure unboxing"
          disabled={!canEdit}
        />
        <Button type="primary" icon={<SearchOutlined />} loading={searching} onClick={runSearch} disabled={!canEdit}>
          搜索 YouTube 红人
        </Button>
      </Space.Compact>
      {!canEdit ? <Typography.Text type="secondary" className="block text-xs">当前角色为只读，无法搜索或导入。</Typography.Text> : null}

      {searched ? (
        <>
          <div className="flex items-center justify-between">
            <Typography.Text type="secondary">共 {items.length} 个创作者，已选 {selectedKeys.length} 个</Typography.Text>
            <Button type="primary" icon={<YoutubeOutlined />} loading={importing} disabled={!canEdit || selectedKeys.length === 0} onClick={importSelected}>
              导入选中候选红人
            </Button>
          </div>
          <Table<ExternalPreview>
            rowKey={(row) => row.externalId ?? row.profileUrl ?? ""}
            size="small"
            columns={columns}
            dataSource={items}
            pagination={false}
            locale={{ emptyText: <Empty description="未找到匹配的 YouTube 创作者" /> }}
            rowSelection={{
              selectedRowKeys: selectedKeys,
              onChange: setSelectedKeys,
            }}
          />
        </>
      ) : null}
    </Card>
  );
}
