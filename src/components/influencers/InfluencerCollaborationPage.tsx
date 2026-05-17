"use client";

import { DeleteOutlined, EditOutlined, LinkOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Card, DatePicker, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Statistic, Table, Tag, Typography, message } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";

type Option = { label: string; value: string | number };

type InfluencerRecord = {
  id: number;
  influencerName: string;
  platform: string;
  accountHandle?: string | null;
  profileUrl?: string | null;
  countryCode?: string | null;
  followerCount: number;
  avgViews: number;
  contentCategory?: string | null;
  cooperationType: string;
  status: string;
  brandId?: number | null;
  channelId?: number | null;
  ownerId?: number | null;
  contactName?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  sampleSku?: string | null;
  sampleQuantity: number;
  sampleCost: number;
  feeAmount: number;
  currency: string;
  exchangeRate: number;
  totalCostBase: number;
  contentCount: number;
  postUrl?: string | null;
  couponCode?: string | null;
  salesAmount: number;
  orderCount: number;
  roi?: number | null;
  linkedOrderCount?: number;
  linkedSalesAmountBase?: number;
  linkedGrossProfit?: number;
  effectiveSalesAmountBase?: number;
  effectiveOrderCount?: number;
  effectiveRoi?: number | null;
  metricSource?: "orders" | "manual";
  rating?: string | null;
  nextFollowupAt?: string | null;
  remark?: string | null;
  brand?: { id: number; name: string; code?: string | null } | null;
  channel?: { id: number; businessLine: string; channelName: string } | null;
  owner?: { id: number; name: string; email: string } | null;
};

type Summary = {
  total: number;
  active: number;
  published: number;
  nextFollowups: number;
  totalCostBase: number;
  salesAmount: number;
  orderCount: number;
  avgRoi?: number | null;
  baseCurrency: string;
};

type ListResponse = {
  items: InfluencerRecord[];
  total: number;
  page: number;
  pageSize: number;
  summary: Summary;
  message?: string;
};

type Filters = {
  keyword?: string;
  status?: string;
  platform?: string;
  cooperationType?: string;
  brandId?: number;
  ownerId?: number;
};

const statusOptions = [
  { label: "线索中", value: "prospecting", color: "default" },
  { label: "已联系", value: "contacted", color: "blue" },
  { label: "已寄样", value: "sample_sent", color: "cyan" },
  { label: "等内容", value: "content_pending", color: "orange" },
  { label: "已发布", value: "published", color: "green" },
  { label: "已结算", value: "settled", color: "purple" },
  { label: "已取消", value: "cancelled", color: "red" },
];

const cooperationTypeOptions = [
  { label: "寄样合作", value: "sample" },
  { label: "付费贴文", value: "paid_post" },
  { label: "佣金合作", value: "commission" },
  { label: "联盟分销", value: "affiliate" },
  { label: "长期合作", value: "long_term" },
  { label: "其他", value: "other" },
];

const platformOptions = ["Instagram", "TikTok", "YouTube", "Facebook", "Pinterest", "Blog", "Other"].map((value) => ({ label: value, value }));
const currencyOptions = ["USD", "CNY", "EUR", "GBP", "JPY"].map((value) => ({ label: value, value }));
const ratingOptions = ["A", "B", "C", "D"].map((value) => ({ label: value, value }));

function labelOf(options: Array<{ label: string; value: string }>, value?: string | null) {
  return options.find((item) => item.value === value)?.label ?? value ?? "-";
}

function colorOf(value?: string | null) {
  return statusOptions.find((item) => item.value === value)?.color ?? "default";
}

function money(value: unknown, currency = "USD") {
  return `${currency} ${Number(value || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortNumber(value: unknown) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function roiText(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
  return `${Number(value).toFixed(2)}x`;
}

function dateText(value?: string | null) {
  return value ? dayjs(value).format("YYYY-MM-DD") : "-";
}

function toQuery(filters: Filters, page: number, pageSize: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

function toDateValue(value?: string | null) {
  return value ? dayjs(value) : null;
}

export default function InfluencerCollaborationPage() {
  const [form] = Form.useForm();
  const [filters, setFilters] = useState<Filters>({});
  const [items, setItems] = useState<InfluencerRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InfluencerRecord | null>(null);
  const [currentRole, setCurrentRole] = useState("viewer");
  const [brands, setBrands] = useState<Option[]>([]);
  const [channels, setChannels] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);

  const canEdit = ["admin", "sales"].includes(currentRole);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/influencers?${toQuery(filters, page, pageSize)}`);
      const data = (await response.json()) as ListResponse;
      if (!response.ok) throw new Error(data.message || "红人合作列表加载失败");
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setSummary(data.summary ?? null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "红人合作列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  const loadOptions = useCallback(async () => {
    const [brandResponse, channelResponse, userResponse, meResponse] = await Promise.all([
      fetch("/api/basic/brands?page=1&pageSize=100&status=active"),
      fetch("/api/basic/channels?page=1&pageSize=100&status=active"),
      fetch("/api/crm/users"),
      fetch("/api/auth/me"),
    ]);
    const [brandData, channelData, userData, meData] = await Promise.all([brandResponse.json(), channelResponse.json(), userResponse.json(), meResponse.json()]);
    setBrands((brandData.items ?? []).map((item: { id: number; name: string; code?: string }) => ({ label: item.code ? `${item.name} (${item.code})` : item.name, value: item.id })));
    setChannels((channelData.items ?? []).map((item: { id: number; businessLine: string; channelName: string }) => ({ label: `${item.businessLine} / ${item.channelName}`, value: item.id })));
    setUsers((userData.items ?? []).map((item: { id: number; name: string; email: string }) => ({ label: `${item.name} (${item.email})`, value: item.id })));
    setCurrentRole(meData.user?.role ?? "viewer");
  }, []);

  useEffect(() => {
    queueMicrotask(loadData);
  }, [loadData]);

  useEffect(() => {
    queueMicrotask(loadOptions);
  }, [loadOptions]);

  function updateFilter(patch: Filters) {
    setPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  }

  function openCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      platform: "Instagram",
      cooperationType: "sample",
      status: "prospecting",
      currency: "USD",
      exchangeRate: 1,
      followerCount: 0,
      avgViews: 0,
      sampleQuantity: 0,
      sampleCost: 0,
      feeAmount: 0,
      contentCount: 0,
      salesAmount: 0,
      orderCount: 0,
    });
    setModalOpen(true);
  }

  function openEdit(record: InfluencerRecord) {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      startDate: toDateValue(record.startDate),
      endDate: toDateValue(record.endDate),
      nextFollowupAt: toDateValue(record.nextFollowupAt),
    });
    setModalOpen(true);
  }

  async function saveRecord() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/influencers/${editing.id}` : "/api/influencers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "保存失败");
      message.success(editing ? "红人合作已更新" : "红人合作已新增");
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(id: number) {
    try {
      const response = await fetch(`/api/influencers/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "删除失败");
      message.success("红人合作已删除");
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  const columns: ColumnsType<InfluencerRecord> = [
    {
      title: "红人",
      dataIndex: "influencerName",
      fixed: "left",
      width: 210,
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-xs text-[var(--muted)]">{row.accountHandle || row.platform}</div>
        </div>
      ),
    },
    { title: "平台", dataIndex: "platform", width: 110 },
    { title: "粉丝", dataIndex: "followerCount", width: 110, align: "right", render: shortNumber },
    { title: "类型", dataIndex: "cooperationType", width: 120, render: (value) => labelOf(cooperationTypeOptions, value) },
    { title: "状态", dataIndex: "status", width: 110, render: (value) => <Tag color={colorOf(value)}>{labelOf(statusOptions, value)}</Tag> },
    { title: "品牌", dataIndex: ["brand", "name"], width: 150, render: (_, row) => row.brand?.name ?? "-" },
    { title: "渠道", dataIndex: ["channel", "channelName"], width: 180, render: (_, row) => (row.channel ? `${row.channel.businessLine} / ${row.channel.channelName}` : "-") },
    { title: "负责人", dataIndex: ["owner", "name"], width: 110, render: (_, row) => row.owner?.name ?? "-" },
    { title: "投入成本", dataIndex: "totalCostBase", width: 130, align: "right", render: (value) => money(value, "CNY") },
    {
      title: "订单销售额",
      dataIndex: "effectiveSalesAmountBase",
      width: 140,
      align: "right",
      render: (value, row) => (
        <div>
          <div>{money(value, "CNY")}</div>
          {row.metricSource === "manual" ? <Tag>手填</Tag> : <Tag color="green">订单汇总</Tag>}
        </div>
      ),
    },
    { title: "订单数", dataIndex: "effectiveOrderCount", width: 90, align: "right" },
    { title: "ROI", dataIndex: "effectiveRoi", width: 90, align: "right", render: (value) => <b className={Number(value || 0) >= 2 ? "text-[var(--success)]" : undefined}>{roiText(value)}</b> },
    { title: "下次跟进", dataIndex: "nextFollowupAt", width: 120, render: dateText },
    {
      title: "内容链接",
      dataIndex: "postUrl",
      width: 100,
      render: (value) =>
        value ? (
          <a href={value} target="_blank" rel="noreferrer">
            <LinkOutlined /> 打开
          </a>
        ) : (
          "-"
        ),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 150,
      render: (_, row) => (
        <Space size={0}>
          {canEdit ? <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>编辑</Button> : null}
          {canEdit ? (
            <Popconfirm title="确认删除这条红人合作记录？" onConfirm={() => deleteRecord(row.id)}>
              <Button danger type="link" size="small" icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    showTotal: (count) => `共 ${count} 条合作记录`,
    onChange: (nextPage, nextPageSize) => {
      setPage(nextPage);
      setPageSize(nextPageSize);
    },
  };

  return (
    <div className="page-stack">
      <div className="page-section-header">
        <div>
          <Typography.Title level={3} className="!mb-1 !text-[var(--foreground)]">红人合作</Typography.Title>
          <Typography.Text type="secondary">管理达人线索、寄样/付费合作、内容发布、费用投入和销售转化；销售额优先来自关联订单自动汇总。</Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>刷新</Button>
          {canEdit ? <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增合作</Button> : null}
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        title="使用方式"
        description="先录入红人账号和合作方式，再在订单里选择对应红人。系统会用关联订单自动汇总销售额、订单数和 ROI；没有关联订单时，才使用本页手填的销售额作为临时参考。"
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 16 }}>
        <Card loading={loading}><Statistic title="合作总数" value={summary?.total ?? 0} suffix="条" /></Card>
        <Card loading={loading}><Statistic title="进行中" value={summary?.active ?? 0} suffix="条" styles={{ content: { color: "var(--chart-blue)" } }} /></Card>
        <Card loading={loading}><Statistic title="已发布" value={summary?.published ?? 0} suffix="条" styles={{ content: { color: "var(--success)" } }} /></Card>
        <Card loading={loading}><Statistic title="投入成本" value={summary ? money(summary.totalCostBase, summary.baseCurrency) : "-"} /></Card>
        <Card loading={loading}><Statistic title="订单销售额" value={summary ? money(summary.salesAmount, summary.baseCurrency) : "-"} styles={{ content: { color: "var(--success)" } }} /></Card>
        <Card loading={loading}><Statistic title="平均 ROI" value={roiText(summary?.avgRoi)} /></Card>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Space wrap>
          <Input allowClear prefix={<SearchOutlined />} placeholder="搜索红人 / 账号 / 平台 / 优惠码" value={filters.keyword} style={{ width: 280 }} onChange={(event) => updateFilter({ keyword: event.target.value })} />
          <Select allowClear placeholder="状态" value={filters.status} style={{ width: 130 }} options={statusOptions.map(({ label, value }) => ({ label, value }))} onChange={(value) => updateFilter({ status: value })} />
          <Select allowClear placeholder="合作类型" value={filters.cooperationType} style={{ width: 130 }} options={cooperationTypeOptions} onChange={(value) => updateFilter({ cooperationType: value })} />
          <Select allowClear placeholder="平台" value={filters.platform} style={{ width: 130 }} options={platformOptions} onChange={(value) => updateFilter({ platform: value })} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="品牌" value={filters.brandId} style={{ width: 190 }} options={brands} onChange={(value) => updateFilter({ brandId: value })} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="负责人" value={filters.ownerId} style={{ width: 190 }} options={users} onChange={(value) => updateFilter({ ownerId: value })} />
          <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); setFilters({}); }}>重置</Button>
        </Space>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<InfluencerRecord>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={items}
          pagination={pagination}
          scroll={{ x: 1900 }}
          locale={{ emptyText: <Empty description="暂无红人合作记录" /> }}
        />
      </Card>

      <Modal title={editing ? "编辑红人合作" : "新增红人合作"} open={modalOpen} width={980} confirmLoading={saving} onCancel={() => setModalOpen(false)} onOk={saveRecord} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Typography.Title level={5}>红人信息</Typography.Title>
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3">
            <Form.Item name="influencerName" label="红人名称" rules={[{ required: true, message: "请输入红人名称" }]}><Input placeholder="例如 Luna Creator Studio" /></Form.Item>
            <Form.Item name="platform" label="平台" rules={[{ required: true, message: "请选择平台" }]}><Select options={platformOptions} /></Form.Item>
            <Form.Item name="accountHandle" label="账号"><Input placeholder="@account" /></Form.Item>
            <Form.Item name="profileUrl" label="主页链接"><Input /></Form.Item>
            <Form.Item name="countryCode" label="国家/地区"><Input placeholder="US" /></Form.Item>
            <Form.Item name="contentCategory" label="内容类目"><Input placeholder="玩具 / 家居 / 开箱" /></Form.Item>
            <Form.Item name="followerCount" label="粉丝数"><InputNumber min={0} precision={0} className="!w-full" /></Form.Item>
            <Form.Item name="avgViews" label="平均播放/浏览"><InputNumber min={0} precision={0} className="!w-full" /></Form.Item>
            <Form.Item name="rating" label="评级"><Select allowClear options={ratingOptions} /></Form.Item>
          </div>

          <Typography.Title level={5}>合作信息</Typography.Title>
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3">
            <Form.Item name="cooperationType" label="合作类型"><Select options={cooperationTypeOptions} /></Form.Item>
            <Form.Item name="status" label="状态"><Select options={statusOptions.map(({ label, value }) => ({ label, value }))} /></Form.Item>
            <Form.Item name="ownerId" label="负责人"><Select allowClear showSearch optionFilterProp="label" options={users} /></Form.Item>
            <Form.Item name="brandId" label="品牌"><Select allowClear showSearch optionFilterProp="label" options={brands} /></Form.Item>
            <Form.Item name="channelId" label="渠道"><Select allowClear showSearch optionFilterProp="label" options={channels} /></Form.Item>
            <Form.Item name="couponCode" label="优惠码/追踪码"><Input /></Form.Item>
            <Form.Item name="startDate" label="开始日期"><DatePicker className="!w-full" /></Form.Item>
            <Form.Item name="endDate" label="结束日期"><DatePicker className="!w-full" /></Form.Item>
            <Form.Item name="nextFollowupAt" label="下次跟进"><DatePicker className="!w-full" /></Form.Item>
          </div>

          <Typography.Title level={5}>费用与结果</Typography.Title>
          <Alert className="!mb-4" type="info" showIcon message="销售额口径" description="如果订单已经关联到该红人，列表和汇总会优先使用订单自动汇总。这里的销售额/订单数只作为没有关联订单前的临时预估。" />
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3">
            <Form.Item name="sampleSku" label="样品 SKU"><Input /></Form.Item>
            <Form.Item name="sampleQuantity" label="样品数量"><InputNumber min={0} precision={0} className="!w-full" /></Form.Item>
            <Form.Item name="sampleCost" label="样品成本"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
            <Form.Item name="feeAmount" label="付费/佣金金额"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
            <Form.Item name="currency" label="币种"><Select options={currencyOptions} /></Form.Item>
            <Form.Item name="exchangeRate" label="汇率"><InputNumber min={0} precision={6} className="!w-full" /></Form.Item>
            <Form.Item name="contentCount" label="内容数量"><InputNumber min={0} precision={0} className="!w-full" /></Form.Item>
            <Form.Item name="postUrl" label="内容链接"><Input /></Form.Item>
            <Form.Item name="salesAmount" label="临时销售额"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
            <Form.Item name="orderCount" label="临时订单数"><InputNumber min={0} precision={0} className="!w-full" /></Form.Item>
          </div>

          <Typography.Title level={5}>联系方式与备注</Typography.Title>
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3">
            <Form.Item name="contactName" label="联系人"><Input /></Form.Item>
            <Form.Item name="email" label="邮箱"><Input /></Form.Item>
            <Form.Item name="whatsapp" label="WhatsApp"><Input /></Form.Item>
            <Form.Item name="remark" label="备注" className="md:col-span-3"><Input.TextArea rows={3} placeholder="记录沟通要求、内容方向、结算说明等" /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
