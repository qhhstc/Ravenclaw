"use client";

import { ArrowLeftOutlined, ImportOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import CandidateImportModal from "./CandidateImportModal";
import {
  candidateStatusMeta,
  candidateStatusOptions,
  fetchJson,
  offerLabel,
  platformOptions,
  rateText,
  shortNumber,
  tierColor,
  tierOptions,
  type CandidateRecord,
} from "./shared";

type ListResponse = { items: CandidateRecord[]; total: number; page: number; pageSize: number };
type Filters = { keyword?: string; status?: string; tier?: string; platform?: string; minScore?: number };

export default function CandidateListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const discoveryRunId = Number(searchParams.get("discoveryRunId")) || null;

  const [form] = Form.useForm();
  const [items, setItems] = useState<CandidateRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState("score");
  const [filters, setFilters] = useState<Filters>({});
  const [loading, setLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort });
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
      });
      if (discoveryRunId) params.set("discoveryRunId", String(discoveryRunId));
      const data = await fetchJson<ListResponse>(`/api/influencers/candidates?${params.toString()}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sort, filters, discoveryRunId]);

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

  async function scoreOne(id: number) {
    try {
      await fetchJson(`/api/influencers/candidates/${id}/score`, { method: "POST" });
      message.success("评分完成");
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "评分失败");
    }
  }

  async function changeStatus(id: number, status: string) {
    try {
      await fetchJson(`/api/influencers/candidates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      message.success("状态已更新");
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "更新失败");
    }
  }

  async function saveCandidate() {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await fetchJson("/api/influencers/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, discoveryRunId }),
      });
      message.success("候选红人已新增");
      setModalOpen(false);
      form.resetFields();
      await loadData();
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return; // 表单校验错误
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  const columns: ColumnsType<CandidateRecord> = [
    {
      title: "账号",
      dataIndex: "handle",
      fixed: "left",
      width: 200,
      render: (_, row) => (
        <div>
          <Link href={`/influencers/candidates/${row.id}`}>{row.displayName || row.handle || row.profileUrl || `#${row.id}`}</Link>
          <div className="text-xs text-[var(--muted)]">{row.platform || "-"}{row.country ? ` · ${row.country}` : ""}</div>
        </div>
      ),
    },
    { title: "粉丝", dataIndex: "followers", width: 90, align: "right", render: shortNumber },
    { title: "均播", dataIndex: "avgViews", width: 90, align: "right", render: shortNumber },
    { title: "互动率", dataIndex: "engagementRate", width: 90, align: "right", render: rateText },
    { title: "分数", dataIndex: "score", width: 80, align: "right", render: (v) => v ?? "-" },
    { title: "等级", dataIndex: "tier", width: 70, render: (v: string | null) => (v ? <Tag color={tierColor[v]}>{v}</Tag> : "-") },
    { title: "推荐合作", dataIndex: "recommendedOffer", width: 100, render: (v: string | null) => (v ? offerLabel[v] ?? v : "-") },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (v: string) => <Tag color={candidateStatusMeta[v]?.color ?? "default"}>{candidateStatusMeta[v]?.label ?? v}</Tag>,
    },
    {
      title: "操作",
      fixed: "right",
      width: 220,
      render: (_, row) => (
        <Space size={4} wrap>
          <Button type="link" size="small" onClick={() => router.push(`/influencers/candidates/${row.id}`)}>详情</Button>
          {canEdit ? <Button type="link" size="small" onClick={() => scoreOne(row.id)}>重算分</Button> : null}
          {canEdit ? <Button type="link" size="small" onClick={() => changeStatus(row.id, "approved")}>批准</Button> : null}
          {canEdit ? <Button type="link" size="small" danger onClick={() => changeStatus(row.id, "rejected")}>拒绝</Button> : null}
        </Space>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <div className="page-section-header">
        <div>
          <Space align="center">
            <Link href="/influencers"><Button icon={<ArrowLeftOutlined />} type="text" /></Link>
            <Typography.Title level={3} className="!mb-1 !text-[var(--foreground)]">候选红人库</Typography.Title>
          </Space>
          <Typography.Text type="secondary">管理候选红人、CSV 导入、可解释评分与筛选排序，评估后可一键转为红人合作记录。</Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>刷新</Button>
          {canEdit ? <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>CSV 导入</Button> : null}
          {canEdit ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新增候选</Button> : null}
        </Space>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Space wrap>
          <Input.Search
            placeholder="账号/名称/邮箱/国家"
            allowClear
            style={{ width: 220 }}
            onSearch={(v) => { setPage(1); setFilters((f) => ({ ...f, keyword: v })); }}
          />
          <Select placeholder="平台" allowClear style={{ width: 130 }} options={platformOptions} onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, platform: v })); }} />
          <Select placeholder="等级" allowClear style={{ width: 110 }} options={tierOptions} onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, tier: v })); }} />
          <Select placeholder="状态" allowClear style={{ width: 130 }} options={candidateStatusOptions} onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, status: v })); }} />
          <InputNumber placeholder="最低分" min={0} max={100} style={{ width: 110 }} onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, minScore: v ?? undefined })); }} />
          <Select
            value={sort}
            style={{ width: 150 }}
            onChange={setSort}
            options={[
              { value: "score", label: "按分数降序" },
              { value: "followers", label: "按粉丝降序" },
              { value: "avgViews", label: "按均播降序" },
              { value: "updatedAt", label: "按更新时间" },
            ]}
          />
        </Space>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<CandidateRecord>
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
        />
      </Card>

      <Modal
        title="新增候选红人"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={saveCandidate}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item name="platform" label="平台"><Select allowClear options={platformOptions} placeholder="选择平台" /></Form.Item>
            <Form.Item name="handle" label="账号"><Input placeholder="@handle" /></Form.Item>
            <Form.Item name="displayName" label="名称"><Input placeholder="红人显示名" /></Form.Item>
            <Form.Item name="country" label="国家"><Input placeholder="如 US" /></Form.Item>
            <Form.Item name="profileUrl" label="主页链接" className="col-span-2"><Input placeholder="https://..." /></Form.Item>
            <Form.Item name="email" label="邮箱"><Input placeholder="name@example.com" /></Form.Item>
            <Form.Item name="followers" label="粉丝数"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
            <Form.Item name="avgViews" label="平均播放"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
            <Form.Item name="engagementRate" label="互动率(%)"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
            <Form.Item name="nicheTags" label="标签(逗号分隔)" className="col-span-2"><Input placeholder="toy review, unboxing" /></Form.Item>
            <Form.Item name="notes" label="备注" className="col-span-2"><Input.TextArea rows={2} /></Form.Item>
          </div>
          <Typography.Text type="secondary" className="text-xs">账号、主页链接、名称至少填写一项。</Typography.Text>
        </Form>
      </Modal>

      <CandidateImportModal open={importOpen} discoveryRunId={discoveryRunId} onCancel={() => setImportOpen(false)} onImported={() => { setImportOpen(false); void loadData(); }} />
    </div>
  );
}
