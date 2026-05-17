"use client";

import { DeleteOutlined, DownloadOutlined, EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Card, DatePicker, Empty, Input, Popconfirm, Select, Space, Table, Typography, message } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import dayjs from "dayjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import OrderFormModal from "./OrderFormModal";
import OrderStatsCards, { emptyStats, type OrderStatsData } from "./OrderStatsCards";
import {
  MarginTag,
  PaymentDueText,
  StatusTag,
  channelLabel,
  formatDate,
  moneyText,
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
  type InfluencerOption,
  type OrderRecord,
  type PlatformOption,
  type ProductOption,
  type StoreOption,
  type UserOption,
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
  salespersonId?: number;
  paymentDue?: string;
  dateFrom?: string;
  dateTo?: string;
};

function toQuery(filters: Filters, page = 1, pageSize = 10) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

function parseInitialFilters(params: URLSearchParams): Filters {
  return {
    paymentDue: params.get("paymentDue") || undefined,
    paymentStatus: params.get("paymentStatus") || undefined,
    shippingStatus: params.get("shippingStatus") || undefined,
  };
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url);
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(data.message || "请求失败");
  return data;
}

function productSummary(row: OrderRecord) {
  const items = row.items ?? [];
  if (!items.length) return "-";
  const suffix = items.length >= 3 ? "..." : "";
  return `${items.map((item) => `${item.productName}x${item.quantity}`).join("，")}${suffix}`;
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
  const [exporting, setExporting] = useState(false);
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
  const [users, setUsers] = useState<UserOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [influencers, setInfluencers] = useState<InfluencerOption[]>([]);
  const [currentRole, setCurrentRole] = useState("viewer");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const loadOptions = useCallback(async () => {
    try {
      const [brandData, platformData, storeData, channelData, countryData, currencyData, customerData, userData, productData, influencerData] = await Promise.all([
        fetchJson<OptionResponse<BrandOption>>("/api/basic/brands?pageSize=100&status=active"),
        fetchJson<OptionResponse<PlatformOption>>("/api/basic/platforms?pageSize=100&status=active"),
        fetchJson<OptionResponse<StoreOption>>("/api/basic/stores?pageSize=100&status=active"),
        fetchJson<OptionResponse<ChannelOption>>("/api/basic/channels?pageSize=100"),
        fetchJson<OptionResponse<CountryOption>>("/api/basic/countries?pageSize=100&status=active"),
        fetchJson<OptionResponse<CurrencyOption>>("/api/basic/currencies?pageSize=100&status=active"),
        fetchJson<OptionResponse<CustomerOption>>("/api/crm/customers?pageSize=100"),
        fetchJson<OptionResponse<UserOption>>("/api/crm/users"),
        fetchJson<OptionResponse<ProductOption>>("/api/products?pageSize=100&status=active"),
        fetchJson<OptionResponse<InfluencerOption>>("/api/influencers?pageSize=100"),
      ]);
      setBrands(brandData.items ?? []);
      setPlatforms(platformData.items ?? []);
      setStores(storeData.items ?? []);
      setChannels(channelData.items ?? []);
      setCountries(countryData.items ?? []);
      setCurrencies(currencyData.items ?? []);
      setCustomers(customerData.items ?? []);
      setUsers(userData.items ?? []);
      setProducts(productData.items ?? []);
      setInfluencers(influencerData.items ?? []);
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
      const data = await fetchJson<OrderStatsData>(`/api/orders/stats?${toQuery(filters)}`);
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
    queueMicrotask(async () => {
      try {
        const data = await fetchJson<{ user: { userId: number; role: string } }>("/api/auth/me");
        setCurrentRole(data.user.role);
        setCurrentUserId(data.user.userId);
      } catch {
        setCurrentRole("viewer");
        setCurrentUserId(null);
      }
    });
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

  function openCreate() {
    setEditing(null);
    queueMicrotask(() => setModalOpen(true));
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

  async function openEdit(row: OrderRecord) {
    try {
      const data = await fetchJson<{ item: OrderRecord }>(`/api/orders/${row.id}`);
      setEditing(data.item);
      setModalOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "订单详情加载失败");
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

  function filenameFromDisposition(disposition: string | null) {
    const utf8Match = disposition?.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
    const fallbackMatch = disposition?.match(/filename="?([^";]+)"?/i);
    return fallbackMatch?.[1] ?? "订单列表.xlsx";
  }

  async function exportOrders() {
    setExporting(true);
    try {
      const response = await fetch(`/api/orders/export?${toQuery(filters, page, pageSize)}`);
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "导出失败");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFromDisposition(response.headers.get("Content-Disposition"));
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      message.success("订单 Excel 已开始下载");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setExporting(false);
    }
  }

  function canEditRow(row: OrderRecord) {
    if (currentRole === "admin") return true;
    if (currentRole !== "sales" || !currentUserId) return false;
    const ownOrder = row.createdBy === currentUserId || row.salespersonId === currentUserId;
    return ownOrder && !["completed", "cancelled", "refunded"].includes(row.orderStatus);
  }

  const columns: ColumnsType<OrderRecord> = [
    { title: "订单编号", dataIndex: "orderNo", fixed: "left", width: 160, render: (value: string, row) => <Link href={`/orders/${row.id}`} className="font-medium">{value}</Link> },
    { title: "客户名称", width: 190, render: (_, row) => row.customerName || row.customer?.name || "散客/平台订单" },
    { title: "下单日期", dataIndex: "orderDate", width: 120, render: formatDate },
    { title: "出货日期", dataIndex: "shipmentDate", width: 120, render: formatDate },
    { title: "产品摘要", width: 260, render: (_, row) => productSummary(row) },
    { title: "销售总金额", dataIndex: "salesAmount", width: 140, align: "right", render: (value, row) => moneyText(value ?? row.totalAmount, row.currency) },
    { title: "总成本", dataIndex: "totalCost", width: 130, align: "right", render: (value, row) => moneyText(value, row.currency) },
    { title: "毛利", dataIndex: "grossProfit", width: 130, align: "right", render: (value, row) => <span className={Number(value) < 0 ? "font-semibold text-red-500" : ""}>{moneyText(value, row.currency)}</span> },
    { title: "毛利率", dataIndex: "grossMargin", width: 100, align: "right", render: (value) => <MarginTag value={value == null ? null : Number(value)} /> },
    { title: "订单状态", dataIndex: "orderStatus", width: 110, render: (value) => <StatusTag type="order" value={value} /> },
    { title: "付款状态", dataIndex: "paymentStatus", width: 110, render: (value) => <StatusTag type="payment" value={value} /> },
    { title: "业务员", width: 120, render: (_, row) => row.salesperson?.name ?? row.creator?.name ?? "-" },
    { title: "应收款到期", dataIndex: "dueDate", width: 130, render: (value, row) => <PaymentDueText value={value} unpaidAmount={Number(row.unpaidAmount)} orderStatus={row.orderStatus} /> },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 190,
      render: (_, row) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => router.push(`/orders/${row.id}`)}>查看</Button>
          {canEditRow(row) ? <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>编辑</Button> : null}
          {currentRole === "admin" ? (
            <Popconfirm title="确认删除该订单？" description="订单商品与成本明细会一并删除。" onConfirm={() => deleteOrder(row.id)}>
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
    showTotal: (count) => `共 ${count} 个订单`,
    onChange: (nextPage, nextPageSize) => {
      setPage(nextPage);
      setPageSize(nextPageSize);
    },
  };

  return (
    <div className="page-stack">
      <div className="page-section-header">
        <div>
          <Typography.Title level={3} className="!mb-1 !text-[var(--foreground)]">订单中心</Typography.Title>
          <Typography.Text type="secondary">外贸订单录入、成本分项与毛利核算主工作台。</Typography.Text>
        </div>
        <Space>
          {["admin", "finance"].includes(currentRole) ? <Button loading={exporting} icon={<DownloadOutlined />} onClick={exportOrders}>导出 Excel</Button> : null}
          {["admin", "sales"].includes(currentRole) ? <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增订单</Button> : null}
        </Space>
      </div>

      <OrderStatsCards stats={statsLoading ? emptyStats : stats} />

      <Card styles={{ body: { padding: 16 } }}>
        <Space size={10} wrap>
          <Input allowClear prefix={<SearchOutlined />} placeholder="订单号 / 客户 / 产品" value={filters.keyword} style={{ width: 220 }} onChange={(event) => updateFilter({ keyword: event.target.value })} />
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
          <Select allowClear showSearch optionFilterProp="label" placeholder="业务员" value={filters.salespersonId} style={{ width: 130 }} options={users.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => updateFilter({ salespersonId: value })} />
          <DatePicker.RangePicker
            value={filters.dateFrom && filters.dateTo ? [dayjs(filters.dateFrom), dayjs(filters.dateTo)] : null}
            onChange={(values) => updateFilter({ dateFrom: values?.[0]?.toISOString(), dateTo: values?.[1]?.endOf("day").toISOString() })}
          />
          <Select allowClear placeholder="回款状态" value={filters.paymentDue} style={{ width: 140 }} options={paymentDueOptions.filter((item) => item.value)} onChange={(value) => updateFilter({ paymentDue: value })} />
          <Button icon={<ReloadOutlined />} loading={loading || statsLoading} onClick={resetFilters}>重置</Button>
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
          scroll={{ x: 1960 }}
          locale={{ emptyText: <Empty description="暂无订单数据" /> }}
        />
      </Card>

      <OrderFormModal
        key={editing ? `edit-${editing.id}` : "new-order"}
        open={modalOpen}
        saving={saving}
        editing={editing}
        brands={brands}
        platforms={platforms}
        stores={stores}
        channels={channels}
        influencers={influencers}
        countries={countries}
        currencies={currencies}
        customers={customers}
        users={users}
        products={products}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={saveOrder}
      />
    </div>
  );
}
