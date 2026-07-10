"use client";

import { ArrowLeftOutlined, ReloadOutlined, ThunderboltOutlined, YoutubeOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Space, Table, Tag, Tabs, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  candidateStatusMeta,
  fetchJson,
  offerLabel,
  rateText,
  runStatusMeta,
  shortNumber,
  tierColor,
  type AutoDiscoverySummary,
  type CandidateRecord,
  type RunRecord,
} from "./shared";
import YoutubeSearchTab from "./YoutubeSearchTab";

type DetailResponse = { item: RunRecord; candidates: CandidateRecord[] };

export default function DiscoveryDetailPage({ runId, youtubeEnabled = false }: { runId: number; youtubeEnabled?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [run, setRun] = useState<RunRecord | null>(null);
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [autoDiscovering, setAutoDiscovering] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const autoTriggered = useRef(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson<DetailResponse>(`/api/influencers/discovery-runs/${runId}`);
      setRun(data.item);
      setCandidates(data.candidates);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    queueMicrotask(loadData);
    queueMicrotask(async () => {
      try {
        const data = await fetchJson<{ user?: { role?: string } }>("/api/auth/me");
        setCanEdit(["admin", "sales"].includes(data.user?.role ?? ""));
      } catch {
        setCanEdit(false);
      }
    });
  }, [loadData]);

  const runAnalyze = useCallback(async () => {
    setAnalyzing(true);
    try {
      const data = await fetchJson<{ item: RunRecord; message?: string; aiGenerated?: boolean; autoDiscovery?: AutoDiscoverySummary }>(
        `/api/influencers/discovery-runs/${runId}/analyze`,
        { method: "POST" },
      );
      setRun(data.item);
      if (data.item.status === "failed") {
        message.error(data.message || "分析失败");
      } else {
        message.success(data.aiGenerated ? "分析完成" : "分析完成（AI 未启用，已生成基础画像）");
        const s = data.autoDiscovery;
        if (s?.enabled && !s.error) message.info(`YouTube 自动搜索：发现 ${s.found}，导入 ${s.created}，评分 ${s.scored}`);
        else if (s?.error) message.warning(s.error);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "分析失败");
    } finally {
      setAnalyzing(false);
    }
  }, [runId]);

  // 从列表页跳转带 autoAnalyze=1 时自动触发一次分析
  useEffect(() => {
    if (searchParams.get("autoAnalyze") === "1" && run?.status === "pending" && canEdit && !autoTriggered.current) {
      autoTriggered.current = true;
      void runAnalyze();
    }
  }, [searchParams, run?.status, canEdit, runAnalyze]);

  async function scoreAll() {
    setScoring(true);
    try {
      const data = await fetchJson<{ scored: number; failed: number; total: number }>(
        `/api/influencers/discovery-runs/${runId}/score-all`,
        { method: "POST" },
      );
      message.success(`评分完成：成功 ${data.scored} 个，失败 ${data.failed} 个`);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "批量评分失败");
    } finally {
      setScoring(false);
    }
  }

  async function runAutoDiscover() {
    setAutoDiscovering(true);
    try {
      const data = await fetchJson<{ autoDiscovery?: AutoDiscoverySummary; error?: string }>(
        `/api/influencers/discovery-runs/${runId}/auto-discover`,
        { method: "POST" },
      );
      const s = data.autoDiscovery;
      if (s?.error) message.warning(s.error);
      else if (s) message.success(`自动搜索完成：发现 ${s.found}，导入 ${s.created}，评分 ${s.scored}，跳过 ${s.skipped}`);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "自动搜索失败");
    } finally {
      setAutoDiscovering(false);
    }
  }

  const keywords = run?.keywordsJson ?? {};
  const kwList = (key: string): string[] => (Array.isArray(keywords[key]) ? keywords[key] : []);
  const autoSummary = run?.analysisJson?.youtubeAutoDiscovery;

  const candidateColumns: ColumnsType<CandidateRecord> = [
    { title: "平台", dataIndex: "platform", width: 100, render: (v) => v ?? "-" },
    {
      title: "账号",
      dataIndex: "handle",
      render: (_, row) => (
        <Link href={`/influencers/candidates/${row.id}`}>{row.displayName || row.handle || row.profileUrl || `#${row.id}`}</Link>
      ),
    },
    { title: "粉丝", dataIndex: "followers", width: 90, align: "right", render: shortNumber },
    { title: "均播", dataIndex: "avgViews", width: 90, align: "right", render: shortNumber },
    { title: "互动率", dataIndex: "engagementRate", width: 90, align: "right", render: rateText },
    { title: "分数", dataIndex: "score", width: 80, align: "right", render: (v) => v ?? "-" },
    { title: "等级", dataIndex: "tier", width: 80, render: (v: string | null) => (v ? <Tag color={tierColor[v]}>{v}</Tag> : "-") },
    { title: "推荐合作", dataIndex: "recommendedOffer", width: 110, render: (v: string | null) => (v ? offerLabel[v] ?? v : "-") },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (v: string) => <Tag color={candidateStatusMeta[v]?.color ?? "default"}>{candidateStatusMeta[v]?.label ?? v}</Tag>,
    },
    {
      title: "操作",
      width: 80,
      render: (_, row) => <Button type="link" size="small" onClick={() => router.push(`/influencers/candidates/${row.id}`)}>详情</Button>,
    },
  ];

  const statusMeta = run ? runStatusMeta[run.status] : undefined;

  return (
    <div className="page-stack">
      <div className="page-section-header">
        <div>
          <Space align="center">
            <Link href="/influencers/discovery"><Button icon={<ArrowLeftOutlined />} type="text" /></Link>
            <Typography.Title level={3} className="!mb-1 !text-[var(--foreground)]">{run?.brandName || run?.websiteUrl || "分析任务"}</Typography.Title>
            {statusMeta ? <Tag color={statusMeta.color}>{statusMeta.label}</Tag> : null}
          </Space>
          {run ? (
            <Typography.Text type="secondary">
              <a href={run.websiteUrl} target="_blank" rel="noreferrer">{run.websiteUrl}</a>
            </Typography.Text>
          ) : null}
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>刷新</Button>
          {canEdit ? <Button icon={<ThunderboltOutlined />} loading={analyzing} onClick={runAnalyze}>重新分析网站</Button> : null}
          {canEdit ? <Button icon={<YoutubeOutlined />} loading={autoDiscovering} onClick={runAutoDiscover}>重新自动搜索</Button> : null}
          {canEdit ? <Button type="primary" loading={scoring} disabled={candidates.length === 0} onClick={scoreAll}>批量评分</Button> : null}
          {canEdit ? <Button onClick={() => router.push(`/influencers/candidates?discoveryRunId=${runId}`)}>管理候选红人</Button> : null}
        </Space>
      </div>

      {run?.status === "failed" && run.errorMessage ? <Alert type="error" showIcon message="分析失败" description={run.errorMessage} /> : null}
      {analyzing ? <Alert type="info" showIcon message="正在抓取网站并分析，可能需要十几秒，请稍候…" /> : null}
      {autoDiscovering ? <Alert type="info" showIcon message="正在基于当前画像自动搜索 YouTube 创作者…" /> : null}

      <Card size="small">
        <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} title="自动发现状态">
          <Descriptions.Item label="网站分析">{statusMeta?.label ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="YouTube 自动搜索">
            {!autoSummary ? "未运行" : autoSummary.enabled === false ? "未启用" : autoSummary.error ? "有提示" : "已完成"}
          </Descriptions.Item>
          <Descriptions.Item label="搜索关键词">{autoSummary?.searchedKeywords?.length ? autoSummary.searchedKeywords.join("、") : "-"}</Descriptions.Item>
          <Descriptions.Item label="自动发现">{autoSummary?.found ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="自动导入">{autoSummary?.created ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="自动评分">{autoSummary?.scored ?? "-"}</Descriptions.Item>
        </Descriptions>
        {autoSummary?.enabled === false ? (
          <Alert className="mt-2" type="warning" showIcon message="网站分析已完成，YouTube 自动搜索未启用，可配置 API Key 后重新自动搜索。" />
        ) : null}
        {autoSummary?.error ? <Alert className="mt-2" type="warning" showIcon message={autoSummary.error} /> : null}
        {autoSummary && !autoSummary.error && autoSummary.enabled && autoSummary.created === 0 ? (
          <Alert className="mt-2" type="info" showIcon message="未自动发现候选红人，可在「数据源搜索」尝试更多关键词。" />
        ) : null}
      </Card>

      <Tabs
        items={[
          {
            key: "profile",
            label: "网站画像",
            children: (
              <Card loading={loading}>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="品牌名">{run?.brandName || "-"}</Descriptions.Item>
                  <Descriptions.Item label="品牌总结">{run?.brandSummary || "-"}</Descriptions.Item>
                  <Descriptions.Item label="产品总结">{run?.productSummary || "-"}</Descriptions.Item>
                  <Descriptions.Item label="受众总结">{run?.audienceSummary || "-"}</Descriptions.Item>
                  <Descriptions.Item label="红人画像">{run?.creatorPersona || "-"}</Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
          {
            key: "keywords",
            label: "推荐关键词",
            children: (
              <Card loading={loading} className="space-y-4">
                <TagGroup title="搜索关键词" values={kwList("keywords")} color="blue" />
                <TagGroup title="红人垂类" values={kwList("creatorNiches")} color="geekblue" />
                <TagGroup title="推荐平台" values={kwList("platforms")} color="cyan" />
                <TagGroup title="目标区域" values={kwList("targetRegions")} color="green" />
                <TagGroup title="排除关键词" values={kwList("negativeKeywords")} color="red" />
              </Card>
            ),
          },
          {
            key: "candidates",
            label: `候选红人 (${candidates.length})`,
            children: (
              <div className="space-y-3">
                <Alert
                  type="info"
                  showIcon
                  message="系统已根据网站画像自动搜索 YouTube 创作者并完成初步评分。你可继续在「数据源搜索」手动补充搜索，或筛选 A/B 类红人转为合作记录。"
                />
              <Card styles={{ body: { padding: 0 } }}>
                <Table<CandidateRecord> rowKey="id" columns={candidateColumns} dataSource={candidates} loading={loading} pagination={false} />
              </Card>
              </div>
            ),
          },
          {
            key: "sources",
            label: "数据源搜索",
            children: <YoutubeSearchTab runId={runId} run={run} youtubeEnabled={youtubeEnabled} canEdit={canEdit} onImported={loadData} />,
          },
          {
            key: "raw",
            label: "AI 原始数据",
            children: (
              <Card loading={loading}>
                <pre className="max-h-[500px] overflow-auto rounded bg-[var(--muted-bg,#f5f5f5)] p-3 text-xs">
                  {run?.analysisJson ? JSON.stringify(run.analysisJson, null, 2) : "暂无数据"}
                </pre>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}

function TagGroup({ title, values, color }: { title: string; values: string[]; color: string }) {
  return (
    <div>
      <Typography.Text strong className="mb-2 block">{title}</Typography.Text>
      {values.length ? (
        <Space wrap>
          {values.map((v) => (
            <Tag key={v} color={color}>{v}</Tag>
          ))}
        </Space>
      ) : (
        <Typography.Text type="secondary">-</Typography.Text>
      )}
    </div>
  );
}
