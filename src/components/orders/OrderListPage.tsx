"use client";

import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Card, DatePicker, Empty, Input, Popconfirm, Select, Space, Table, Typography, message } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import dayjs from "dayjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import OrderFormModal from "./OrderFormModal";
import OrderStatsCards, { emptyStats, type OrderStatsData } from "./OrderStatsCards";
import {
  PaymentDueText,
  StatusTag,
  channelLabel,
  formatDate,
  moneyText,
  optionLabel,
  orderSourceOptions,
  orderStatusOptions,
  paymentDueOptions,
  paymentStatusOptions,
  shippingStatusOptions,
  type BrandOption,
  type ChannelOption,
  type CountryOption,
  type CurrencyOption,
  type CustomerOption,
  type OrderRecord,
  type PlatformOption,
  type StoreOption,
} from "./orderOptions";

type ListResponse<T> = { items: T[]; total: number; page: number; pageSize: number; message?: string };
type OptionResponse<T> = { items: T[]; message?: string };

type Filters = {
  keyword?: string;
  orderSource?: string;
  orderStatus?: string;
  paymentStatus?: string;
  shippingStatus?: string;
  brandId?: number;
  platformId?: number;
  storeId?: number;
  channelId?: number;
  countryCode?: string;
  currency?: string;
  paymentDue?: string;
  dateFrom?: string;
  dateTo?: string;
};

function toQuery(filters: Filters, page: number, pageSize: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

function parseInitialFilters(params: URLSearchParams): Filters {
  return {
    paymentDue: params.get("paymentDue") || undefined,
  };
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url);
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(data.message || "请求失败");
  return data;
}

export default function OrderListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => parseInitialFilters(searchParams));
  const [items, setItems] = useState<OrderRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrderRecord | null>(null);
  const [stats, setStats] = useState<OrderStatsData>(emptyStats);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [platforms, setPlatforms] = useState<PlatformOption[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  const loadOptions = useCallback(async () => {
    try {
      const [brandData, platformData, storeData, channelData, countryData, currencyData, customerData] = await Promise.all([
        fetchJson<OptionResponse<BrandOption>>("/api/basic/brands?pageSize=100&status=active"),
        fetchJson<OptionResponse<PlatformOption>>("/api/basic/platforms?pageSize=100&status=active"),
        fetchJson<OptionResponse<StoreOption>>("/api/basic/stores?pageSize=100&status=active"),
        fetchJson<OptionResponse<ChannelOption>>("/api/basic/channels?pageSize=100"),
        fetchJson<OptionResponse<CountryOption>>("/api/basic/countries?pageSize=100&status=active"),
        fetchJson<OptionResponse<CurrencyOption>>("/api/basic/currencies?pageSize=100&status=active"),
        fetchJson<OptionResponse<CustomerOption>>("/api/crm/customers?pageSize=100"),
      ]);
      setBrands(brandData.items ?? []);
      setPlatforms(platformData.items ?? []);
      setStores(storeData.items ?? []);
      setChannels(channelData.items ?? []);
      setCountries(countryData.items ?? []);
      setCurrencies(currencyData.items ?? []);
      setCustomers(customerData.items ?? []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "基础选项加载失败");
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson<ListResponse<OrderRecord>>(`/api/orders?${toQuery(filters, page, pageSize)}`);
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "订单列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await fetchJson<OrderStatsData>(`/api/orders/stats?${toQuery(filters, 1, 10)}`);
      setStats(data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "订单统计加载失败");
      setStats(emptyStats);
    } finally {
      setStatsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    queueMicrotask(loadOptions);
  }, [loadOptions]);

  useEffect(() => {
    queueMicrotask(loadOrders);
    queueMicrotask(loadStats);
  }, [loadOrders, loadStats]);

  function updateFilter(patch: Filters) {
    setPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  }

  function resetFilters() {
    setPage(1);
    setFilters({});
  }

  async function saveOrder(values: Record<string, unknown>) {
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/orders/${editing.id}` : "/api/orders", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "保存失败");
      message.success(editing ? "订单已更新" : "订单已创建");
      setModalOpen(false);
      setEditing(null);
      await loadOrders();
      await loadStats();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrder(id: number) {
    try {
      const response = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "删除失败");
      message.success("订单已删除");
      await loadOrders();
      await loadStats();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  const columns: ColumnsType<OrderRecord> = [
    { title: "订单编号", dataIndex: "orderNo", fixed: "left", width: 160, render: (value: string, row) => <Link href={`/orders/${row.id}`} className="font-medium">{value}</Link> },
    { title: "外部订单号", dataIndex: "externalOrderNo", width: 130, render: (value) => value || "-" },
    { title: "来源", dataIndex: "orderSource", width: 130, render: (value) => optionLabel(orderSourceOptions, value) },
    { title: "客户名称", width: 180, render: (_, row) => row.customer?.name ?? "散客/平台订单" },
    { title: "公司名称", width: 170, render: (_, row) => row.customer?.companyName ?? "-" },
    { title: "品牌", width: 110, render: (_, row) => row.brand?.name ?? "-" },
    { title: "平台", width: 110, render: (_, row) => row.platform?.name ?? "-" },
    { title: "店铺/站点", width: 170, render: (_, row) => row.store?.name ?? "-" },
    { title: "国家", dataIndex: "countryCode", width: 80, render: (value) => value || "-" },
    { title: "币种", dataIndex: "currency", width: 80 },
    { title: "订单金额", dataIndex: "totalAmount", width: 130, align: "right", render: (value, row) => moneyText(value, row.currency) },
    { title: "已收金额", dataIndex: "paidAmount", width: 130, align: "right", render: (value, row) => moneyText(value, row.currency) },
    { title: "未收金额", dataIndex: "unpaidAmount", width: 130, align: "right", render: (value, row) => <span className={Number(value) > 0 ? "font-semibold text-orange-500" : ""}>{moneyText(value, row.currency)}</span> },
    { title: "订单状态", dataIndex: "orderStatus", width: 110, render: (value) => <StatusTag type="order" value={value} /> },
    { title: "付款状态", dataIndex: "paymentStatus", width: 110, render: (value) => <StatusTag type="payment" value={value} /> },
    { title: "发货状态", dataIndex: "shippingStatus", width: 110, render: (value) => <StatusTag type="shipping" value={value} /> },
    { title: "下单日期", dataIndex: "orderDate", width: 120, render: formatDate },
    { title: "应收款到期", dataIndex: "dueDate", width: 130, render: (value, row) => <PaymentDueText value={value} unpaidAmount={Number(row.unpaidAmount)} orderStatus={row.orderStatus} /> },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 190,
      render: (_, row) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => router.push(`/orders/${row.id}`)}>查看</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(row); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除该订单？" description="订单商品明细会一并删除。" onConfirm={() => deleteOrder(row.id)}>
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
    showTotal: (count) => `共 ${count} 个订单`,
    onChange: (nextPage, nextPageSize) => {
      setPage(nextPage);
      setPageSize(nextPageSize);
    },
  };

  return (
    <div className="max-w-full overflow-hidden">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!mb-1 !text-[#172033]">订单中心</Typography.Title>
          <Typography.Text type="secondary">统一管理报价、批发站、独立站、Amazon、TikTok 与手动订单。</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true); }}>新增订单</Button>
      </div>

      <div className="mb-4 opacity-100">
        <OrderStatsCards stats={statsLoading ? emptyStats : stats} />
      </div>

      <Card className="mb-4" styles={{ body: { padding: 16 } }}>
        <Space size={10} wrap>
          <Input allowClear prefix={<SearchOutlined />} placeholder="订单/客户/商品" value={filters.keyword} style={{ width: 220 }} onChange={(event) => updateFilter({ keyword: event.target.value })} />
          <Select allowClear placeholder="订单来源" value={filters.orderSource} style={{ width: 150 }} options={orderSourceOptions} onChange={(value) => updateFilter({ orderSource: value })} />
          <Select allowClear placeholder="订单状态" value={filters.orderStatus} style={{ width: 130 }} options={orderStatusOptions.map(({ label, value }) => ({ label, value }))} onChange={(value) => updateFilter({ orderStatus: value })} />
          <Select allowClear placeholder="付款状态" value={filters.paymentStatus} style={{ width: 130 }} options={paymentStatusOptions.map(({ label, value }) => ({ label, value }))} onChange={(value) => updateFilter({ paymentStatus: value })} />
          <Select allowClear placeholder="发货状态" value={filters.shippingStatus} style={{ width: 130 }} options={shippingStatusOptions.map(({ label, value }) => ({ label, value }))} onChange={(value) => updateFilter({ shippingStatus: value })} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="品牌" value={filters.brandId} style={{ width: 130 }} options={brands.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => updateFilter({ brandId: value })} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="平台" value={filters.platformId} style={{ width: 130 }} options={platforms.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => updateFilter({ platformId: value })} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="店铺/站点" value={filters.storeId} style={{ width: 160 }} options={stores.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => updateFilter({ storeId: value })} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="来源渠道" value={filters.channelId} style={{ width: 180 }} options={channels.map((item) => ({ label: channelLabel(item), value: item.id }))} onChange={(value) => updateFilter({ channelId: value })} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="国家" value={filters.countryCode} style={{ width: 130 }} options={countries.map((item) => ({ label: `${item.name} (${item.code})`, value: item.code }))} onChange={(value) => updateFilter({ countryCode: value })} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="币种" value={filters.currency} style={{ width: 110 }} options={currencies.map((item) => ({ label: item.code, value: item.code }))} onChange={(value) => updateFilter({ currency: value })} />
          <DatePicker.RangePicker
            value={filters.dateFrom && filters.dateTo ? [dayjs(filters.dateFrom), dayjs(filters.dateTo)] : null}
            onChange={(values) => updateFilter({ dateFrom: values?.[0]?.toISOString(), dateTo: values?.[1]?.endOf("day").toISOString() })}
          />
          <Select allowClear placeholder="回款状态" value={filters.paymentDue} style={{ width: 140 }} options={paymentDueOptions.filter((item) => item.value)} onChange={(value) => updateFilter({ paymentDue: value })} />
          <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
        </Space>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<OrderRecord>
          rowKey="id"
          size="middle"
          loading={loading}
          columns={columns}
          dataSource={items}
          pagination={pagination}
          scroll={{ x: 2360 }}
          locale={{ emptyText: <Empty description="暂无订单数据" /> }}
        />
      </Card>

      <OrderFormModal
        open={modalOpen}
        saving={saving}
        editing={editing}
        brands={brands}
        platforms={platforms}
        stores={stores}
        channels={channels}
        countries={countries}
        currencies={currencies}
        customers={customers}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={saveOrder}
      />
    </div>
  );
}
