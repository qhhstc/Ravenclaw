"use client";

import { ArrowLeftOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Input, Progress, Space, Tag, Typography, message } from "antd";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { candidateStatusMeta, fetchJson, offerLabel, rateText, shortNumber, tierColor, type CandidateRecord } from "./shared";

// 评分维度中文标签与满分
const SCORE_DIMENSIONS: Array<{ key: string; label: string; max: number }> = [
  { key: "contentFit", label: "内容匹配度", max: 25 },
  { key: "ipProductFit", label: "IP/产品匹配", max: 15 },
  { key: "dataQuality", label: "数据质量", max: 15 },
  { key: "engagementQuality", label: "互动质量", max: 10 },
  { key: "audienceFit", label: "受众匹配", max: 10 },
  { key: "commercePotential", label: "商业转化潜力", max: 10 },
  { key: "costEfficiency", label: "成本效率", max: 10 },
  { key: "contactability", label: "联系可达性", max: 5 },
];

export default function CandidateDetailPage({ candidateId }: { candidateId: number }) {
  const [item, setItem] = useState<CandidateRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson<{ item: CandidateRecord }>(`/api/influencers/candidates/${candidateId}`);
      setItem(data.item);
      setNotes(data.item.notes ?? "");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

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

  async function action(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try {
      await fn();
      message.success(okMsg);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  const rescore = () => action(() => fetchJson(`/api/influencers/candidates/${candidateId}/score`, { method: "POST" }), "评分完成");
  const patch = (body: Record<string, unknown>, okMsg: string) =>
    action(
      () => fetchJson(`/api/influencers/candidates/${candidateId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      okMsg,
    );
  const convert = () =>
    action(async () => {
      await fetchJson(`/api/influencers/candidates/${candidateId}/convert`, { method: "POST" });
    }, "已转为红人合作记录");

  const details = item?.scoreDetailsJson ?? null;
  const nextSteps = item ? buildNextSteps(item) : "";

  return (
    <div className="page-stack">
      <div className="page-section-header">
        <div>
          <Space align="center">
            <Link href="/influencers/candidates"><Button icon={<ArrowLeftOutlined />} type="text" /></Link>
            <Typography.Title level={3} className="!mb-1 !text-[var(--foreground)]">
              {item?.displayName || item?.handle || item?.profileUrl || `候选红人 #${candidateId}`}
            </Typography.Title>
            {item?.tier ? <Tag color={tierColor[item.tier]}>{item.tier} 级</Tag> : null}
            {item ? <Tag color={candidateStatusMeta[item.status]?.color ?? "default"}>{candidateStatusMeta[item.status]?.label ?? item.status}</Tag> : null}
          </Space>
        </div>
        <Space wrap>
          {canEdit ? <Button loading={busy} onClick={rescore}>重新评分</Button> : null}
          {canEdit ? <Button loading={busy} onClick={() => patch({ status: "approved" }, "已批准")}>批准</Button> : null}
          {canEdit ? <Button loading={busy} danger onClick={() => patch({ status: "rejected" }, "已拒绝")}>拒绝</Button> : null}
          {canEdit ? <Button type="primary" loading={busy} disabled={item?.status === "collaboration"} onClick={convert}>转为合作记录</Button> : null}
        </Space>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 16 }}>
        <Card title="基础信息" loading={loading}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="平台">{item?.platform || "-"}</Descriptions.Item>
            <Descriptions.Item label="账号">{item?.handle || "-"}</Descriptions.Item>
            <Descriptions.Item label="主页">{item?.profileUrl ? <a href={item.profileUrl} target="_blank" rel="noreferrer">{item.profileUrl}</a> : "-"}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{item?.email || "-"}</Descriptions.Item>
            <Descriptions.Item label="国家">{item?.country || "-"}</Descriptions.Item>
            <Descriptions.Item label="来源">{item?.source || "-"}</Descriptions.Item>
            <Descriptions.Item label="来源分析">
              {item?.discoveryRun ? <Link href={`/influencers/discovery/${item.discoveryRun.id}`}>{item.discoveryRun.brandName || item.discoveryRun.websiteUrl}</Link> : "-"}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="数据表现" loading={loading}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="粉丝数">{shortNumber(item?.followers)}</Descriptions.Item>
            <Descriptions.Item label="平均播放">{shortNumber(item?.avgViews)}</Descriptions.Item>
            <Descriptions.Item label="互动率">{rateText(item?.engagementRate)}</Descriptions.Item>
            <Descriptions.Item label="平均点赞">{shortNumber(item?.avgLikes)}</Descriptions.Item>
            <Descriptions.Item label="平均评论">{shortNumber(item?.avgComments)}</Descriptions.Item>
          </Descriptions>
          <div className="mt-3">
            <Typography.Text strong className="mb-1 block">标签</Typography.Text>
            {item?.nicheTags?.length ? <Space wrap>{item.nicheTags.map((t) => <Tag key={t}>{t}</Tag>)}</Space> : <Typography.Text type="secondary">-</Typography.Text>}
          </div>
        </Card>
      </div>

      <Card title={`评分明细${item?.score !== null && item?.score !== undefined ? `（总分 ${item.score}）` : ""}`} loading={loading}>
        {details ? (
          <div className="space-y-2">
            {SCORE_DIMENSIONS.map((d) => {
              const value = Number(details[d.key] ?? 0);
              return (
                <div key={d.key} className="flex items-center gap-3">
                  <div className="w-28 text-sm">{d.label}</div>
                  <Progress percent={Math.round((value / d.max) * 100)} format={() => `${value}/${d.max}`} size="small" style={{ flex: 1 }} />
                </div>
              );
            })}
            {typeof details.riskPenalty === "number" && details.riskPenalty > 0 ? (
              <div className="flex items-center gap-3">
                <div className="w-28 text-sm text-[var(--error,red)]">风险扣分</div>
                <Typography.Text type="danger">-{details.riskPenalty}</Typography.Text>
              </div>
            ) : null}
          </div>
        ) : (
          <Alert type="info" showIcon message="尚未评分，点击右上角「重新评分」生成评分明细。" />
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 16 }}>
        <Card title="AI 理由" loading={loading}>
          <Typography.Paragraph>{item?.aiReason || "暂无（AI 未启用或未评分）"}</Typography.Paragraph>
        </Card>
        <Card title="风险提示" loading={loading}>
          <Typography.Paragraph>{item?.riskNotes || "暂无"}</Typography.Paragraph>
        </Card>
      </div>

      <Card title="下一步建议" loading={loading}>
        <Typography.Paragraph>
          {item?.recommendedOffer ? <Tag color="blue">推荐：{offerLabel[item.recommendedOffer] ?? item.recommendedOffer}</Tag> : null}
          {nextSteps}
        </Typography.Paragraph>
      </Card>

      <Card title="备注">
        <Input.TextArea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} />
        {canEdit ? (
          <Button className="mt-3" type="primary" loading={busy} onClick={() => patch({ notes }, "备注已保存")}>
            保存备注
          </Button>
        ) : null}
      </Card>
    </div>
  );
}

function buildNextSteps(item: CandidateRecord): string {
  switch (item.recommendedOffer) {
    case "paid":
      return "综合表现优秀，建议优先付费合作或联盟分销 + 寄样，尽快联系确认档期与报价。";
    case "affiliate":
      return "适合联盟分销/付费合作，可先寄样验证内容质量，再谈长期分成。";
    case "gifted":
      return "适合寄样合作，用样品置换内容，观察转化后再决定是否升级为付费。";
    case "nurture":
      return "暂列为培育对象，保持关注，补齐数据或等待其成长后再评估。";
    case "reject":
      return "当前不建议合作，数据或匹配度不足，可暂不投入。";
    default:
      return "尚未评分，建议先执行评分再决定合作方式。";
  }
}
