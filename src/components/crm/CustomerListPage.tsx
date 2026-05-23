"use client";

import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Input, Popconfirm, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import CustomerFormModal from "./CustomerFormModal";
import {
  FollowupTime,
  LevelTag,
  StatusTag,
  channelLabel,
  customerLevelOptions,
  customerStatusOptions,
  customerTypeOptions,
  followupStatusOptions,
  formatDateTime,
  optionLabel,
  type CrmBrand,
  type CrmChannel,
  type CrmCountry,
  type CrmUser,
  type CustomerRecord,
} from "./crmOptions";

type ListResponse<T> = { items: T[]; total: number; page: number; pageSize: number; message?: string };
type OptionResponse<T> = { items: T[]; message?: string };

type Filters = {
  keyword?: string;
  customerType?: string;
  status?: string;
  level?: string;
  brandId?: number;
  sourceChannelId?: number;
  countryCode?: string;
  ownerId?: number;
  followupStatus?: string;
};

type ChannelApiRecord = CrmChannel & { brand?: CrmBrand | null };

const defaultFilters: Filters = {};

function toQuery(filters: Filters, page: number, pageSize: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

function parseInitialFilters(params: URLSearchParams): Filters {
  return {
    followupStatus: params.get("followupStatus") || undefined,
  };
}

function contactText(row: CustomerRecord) {
  return row.email || row.whatsapp || row.phone || "-";
}

export default function CustomerListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => parseInitialFilters(searchParams));
  const [items, setItems] = useState<CustomerRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRecord | null>(null);
  const [brands, setBrands] = useState<CrmBrand[]>([]);
  const [countries, setCountries] = useState<CrmCountry[]>([]);
  const [channels, setChannels] = useState<CrmChannel[]>([]);
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [currentUser, setCurrentUser] = useState<{ userId: number; role: string } | null>(null);
  const isSales = currentUser?.role === "sales";

  const loadOptions = useCallback(async () => {
    try {
      const [brandRes, countryRes, channelRes, userRes] = await Promise.all([
        fetch("/api/basic/brands?pageSize=100&status=active"),
        fetch("/api/basic/countries?pageSize=100&status=active"),
        fetch("/api/basic/channels?pageSize=100"),
        fetch("/api/crm/users"),
      ]);
      const [brandData, countryData, channelData, userData] = (await Promise.all([brandRes.json(), countryRes.json(), channelRes.json(), userRes.json()])) as [OptionResponse<CrmBrand>, OptionResponse<CrmCountry>, OptionResponse<ChannelApiRecord>, OptionResponse<CrmUser>];
      if (!brandRes.ok) throw new Error(brandData.message || "品牌加载失败");
      if (!countryRes.ok) throw new Error(countryData.message || "国家加载失败");
      if (!channelRes.ok) throw new Error(channelData.message || "渠道加载失败");
      if (!userRes.ok) throw new Error(userData.message || "用户加载失败");
      setBrands(brandData.items);
      setCountries(countryData.items);
      setChannels(channelData.items);
      setUsers(userData.items);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "筛选项加载失败");
    }
  }, []);

  const loadCurrentUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me");
      const data = (await response.json()) as { user?: { userId: number; role: string }; message?: string };
      if (!response.ok) throw new Error(data.message || "当前用户加载失败");
      setCurrentUser(data.user ?? null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "当前用户加载失败");
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/crm/customers?${toQuery(filters, page, pageSize)}`);
      const data = (await response.json()) as ListResponse<CustomerRecord>;
      if (!response.ok) throw new Error(data.message || "客户列表加载失败");
      setItems(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "客户列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    queueMicrotask(loadCurrentUser);
    queueMicrotask(loadOptions);
  }, [loadCurrentUser, loadOptions]);

  useEffect(() => {
    queueMicrotask(loadCustomers);
  }, [loadCustomers]);

  async function saveCustomer(values: Record<string, unknown>) {
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/crm/customers/${editing.id}` : "/api/crm/customers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "保存失败");
      message.success(editing ? "客户已更新" : "客户已创建");
      setModalOpen(false);
      setEditing(null);
      await loadCustomers();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer(id: number) {
    try {
      const response = await fetch(`/api/crm/customers/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "删除失败");
      message.success("客户已删除");
      await loadCustomers();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  function updateFilter(patch: Filters) {
    setPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  }

  const columns: ColumnsType<CustomerRecord> = [
      {
        title: "客户名称",
        dataIndex: "name",
        fixed: "left",
        width: 210,
        render: (value: string, row) => <Link href={`/crm/customers/${row.id}`} className="font-medium">{value}</Link>,
      },
      { title: "公司名称", dataIndex: "companyName", width: 180, render: (value) => value || "-" },
      { title: "客户类型", dataIndex: "customerType", width: 120, render: (value) => optionLabel(customerTypeOptions, value) },
      { title: "国家", dataIndex: "countryCode", width: 90, render: (value) => value || "-" },
      { title: "联系方式", key: "contact", width: 190, render: (_, row) => contactText(row) },
      { title: "所属品牌", dataIndex: ["brand", "name"], width: 120, render: (_, row) => row.brand?.name ?? "-" },
      { title: "来源渠道", key: "source", width: 230, render: (_, row) => channelLabel(row.sourceChannel) },
      { title: "等级", dataIndex: "level", width: 80, render: (value) => <LevelTag level={value} /> },
      { title: "状态", dataIndex: "status", width: 110, render: (value) => <StatusTag status={value} /> },
      { title: "负责人", dataIndex: ["owner", "name"], width: 110, render: (_, row) => row.owner?.name ?? "-" },
      { title: "最近跟进", dataIndex: "lastFollowupAt", width: 150, render: formatDateTime },
      { title: "下次跟进", dataIndex: "nextFollowupAt", width: 160, render: (value, row) => <FollowupTime value={value} status={row.status} /> },
      { title: "标签", dataIndex: "tags", width: 180, render: (tags?: string[]) => (tags?.length ? tags.map((tag) => <Tag key={tag}>{tag}</Tag>) : "-") },
      { title: "创建时间", dataIndex: "createdAt", width: 150, render: formatDateTime },
      {
        title: "操作",
        key: "actions",
        fixed: "right",
        width: 220,
        render: (_, row) => (
          <Space size={0} className="whitespace-nowrap">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => router.push(`/crm/customers/${row.id}`)}>查看</Button>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(row); setModalOpen(true); }}>编辑</Button>
            <Popconfirm title="确认删除该客户？" description="联系人和跟进记录会一并删除。" onConfirm={() => deleteCustomer(row.id)}>
              <Button danger type="link" size="small" icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          </Space>
        ),
      },
  ];

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    showTotal: (count) => `共 ${count} 个客户`,
    onChange: (nextPage, nextPageSize) => {
      setPage(nextPage);
      setPageSize(nextPageSize);
    },
  };

  return (
    <div className="page-stack">
      <div className="page-section-header">
        <div>
          <Typography.Title level={3} className="!mb-1 !text-[var(--foreground)]">客户 CRM</Typography.Title>
          <Typography.Text type="secondary">管理客户档案、来源渠道、负责人、联系人与跟进计划。</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true); }}>新增客户</Button>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="flex flex-wrap items-center gap-3">
          <Input allowClear prefix={<SearchOutlined />} placeholder="搜索客户/公司/邮箱/WhatsApp/网站" value={filters.keyword} onChange={(event) => updateFilter({ keyword: event.target.value || undefined })} style={{ width: 280 }} />
          <Select allowClear placeholder="客户类型" value={filters.customerType} options={customerTypeOptions} onChange={(value) => updateFilter({ customerType: value })} style={{ width: 130 }} />
          <Select allowClear placeholder="客户状态" value={filters.status} options={customerStatusOptions.map(({ label, value }) => ({ label, value }))} onChange={(value) => updateFilter({ status: value })} style={{ width: 130 }} />
          <Select allowClear placeholder="等级" value={filters.level} options={customerLevelOptions.map(({ label, value }) => ({ label, value }))} onChange={(value) => updateFilter({ level: value })} style={{ width: 100 }} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="品牌" value={filters.brandId} options={brands.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => updateFilter({ brandId: value })} style={{ width: 140 }} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="来源渠道" value={filters.sourceChannelId} options={channels.map((item) => ({ label: channelLabel(item), value: item.id }))} onChange={(value) => updateFilter({ sourceChannelId: value })} style={{ width: 220 }} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="国家" value={filters.countryCode} options={countries.map((item) => ({ label: `${item.name} (${item.code})`, value: item.code }))} onChange={(value) => updateFilter({ countryCode: value })} style={{ width: 150 }} />
          {!isSales ? <Select allowClear showSearch optionFilterProp="label" placeholder="负责人" value={filters.ownerId} options={users.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => updateFilter({ ownerId: value })} style={{ width: 130 }} /> : null}
          <Select placeholder="待跟进" value={filters.followupStatus ?? ""} options={followupStatusOptions} onChange={(value) => updateFilter({ followupStatus: value || undefined })} style={{ width: 140 }} />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => { setFilters(defaultFilters); setPage(1); }}>重置</Button>
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<CustomerRecord>
          size="middle"
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={items}
          pagination={pagination}
          scroll={{ x: 2050 }}
          locale={{ emptyText: <Empty description="暂无客户数据" /> }}
        />
      </Card>

      <CustomerFormModal
        open={modalOpen}
        saving={saving}
        editing={editing}
        brands={brands}
        countries={countries}
        channels={channels}
        users={users}
        currentUser={currentUser}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={saveCustomer}
      />
    </div>
  );
}
