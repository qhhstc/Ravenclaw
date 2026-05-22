"use client";

import { ArrowLeftOutlined, EditOutlined } from "@ant-design/icons";
import { Button, Card, Col, Descriptions, Empty, Row, Space, Spin, Statistic, Table, Tabs, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OrderAttachmentPanel from "./OrderAttachmentPanel";
import OrderCostModal from "./OrderCostModal";
import OrderFormModal from "./OrderFormModal";
import OrderPaymentPanel from "./OrderPaymentPanel";
import OrderShipmentPanel from "./OrderShipmentPanel";
import OrderSourcePanel from "./OrderSourcePanel";
import OrderStatusLogPanel from "./OrderStatusLogPanel";
import {
  MarginTag,
  PaymentDueText,
  StatusTag,
  channelLabel,
  compactMoneyText,
  costTypeLabel,
  formatDate,
  formatDateTime,
  marginColor,
  moneyText,
  optionLabel,
  orderSourceOptions,
  type BrandOption,
  type ChannelOption,
  type CountryOption,
  type CurrencyOption,
  type CustomerOption,
  type InfluencerOption,
  type OrderCostRecord,
  type OrderItemRecord,
  type OrderRecord,
  type PlatformOption,
  type ProductOption,
  type StoreOption,
  type UserOption,
} from "./orderOptions";

type Props = { orderId: number };
type ItemResponse = { item?: OrderRecord; message?: string };
type OptionResponse<T> = { items: T[]; message?: string };

async function fetchJson<T>(url: string) {
  const response = await fetch(url);
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(data.message || "请求失败");
  return data;
}

export default function OrderDetailPage({ orderId }: Props) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [costSaving, setCostSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
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

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson<ItemResponse>(`/api/orders/${orderId}`);
      if (!data.item) throw new Error("订单不存在或已被删除");
      setOrder(data.item);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "订单详情加载失败");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const loadOptions = useCallback(async () => {
    if (optionsLoaded) return true;
    setOptionsLoading(true);
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
      setOptionsLoaded(true);
      return true;
    } catch {
      message.error("基础选项加载失败");
      return false;
    } finally {
      setOptionsLoading(false);
    }
  }, [optionsLoaded]);

  useEffect(() => {
    queueMicrotask(loadOrder);
    queueMicrotask(async () => {
      try {
        const me = await fetchJson<{ user: { userId: number; role: string } }>("/api/auth/me");
        setCurrentRole(me.user.role);
        setCurrentUserId(me.user.userId);
      } catch {
        setCurrentRole("viewer");
        setCurrentUserId(null);
      }
    });
  }, [loadOrder]);

  async function openEditModal() {
    const loaded = await loadOptions();
    if (loaded) setModalOpen(true);
  }

  async function saveOrder(values: Record<string, unknown>) {
    setSaving(true);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "保存失败");
      message.success("订单已更新");
      setModalOpen(false);
      await loadOrder();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveCosts(values: { costs: Record<string, unknown>[] }) {
    setCostSaving(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/costs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "成本保存失败");
      message.success("订单成本已更新");
      setCostModalOpen(false);
      await loadOrder();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "成本保存失败");
    } finally {
      setCostSaving(false);
    }
  }

  const itemColumns: ColumnsType<OrderItemRecord> = [
    { title: "SKU", dataIndex: "sku", width: 130, render: (value) => value || "-" },
    { title: "商品名称", dataIndex: "productName", width: 240 },
    { title: "规格", dataIndex: "specification", width: 160, render: (value) => value || "-" },
    { title: "数量", dataIndex: "quantity", width: 90, align: "right" },
    { title: "销售单价", dataIndex: "saleUnitPrice", width: 120, align: "right", render: (value) => moneyText(value, order?.currency) },
    { title: "销售小计", dataIndex: "salesSubtotal", width: 130, align: "right", render: (value) => moneyText(value, order?.currency) },
    { title: "采购单价", dataIndex: "purchaseUnitCost", width: 120, align: "right", render: (value, row) => moneyText(value, row.purchaseCurrency || order?.baseCurrency || "CNY") },
    { title: "采购成本", dataIndex: "purchaseCostSubtotal", width: 130, align: "right", render: (value, row) => moneyText(value, row.purchaseCurrency || order?.baseCurrency || "CNY") },
    { title: "采购本位币", dataIndex: "purchaseCostBase", width: 140, align: "right", render: (value) => moneyText(value, order?.baseCurrency || "CNY") },
    { title: "包装单价", dataIndex: "packagingUnitCost", width: 120, align: "right", render: (value, row) => moneyText(value, row.packagingCurrency || order?.baseCurrency || "CNY") },
    { title: "包装成本", dataIndex: "packagingCostSubtotal", width: 130, align: "right", render: (value, row) => moneyText(value, row.packagingCurrency || order?.baseCurrency || "CNY") },
    { title: "包装本位币", dataIndex: "packagingCostBase", width: 140, align: "right", render: (value) => moneyText(value, order?.baseCurrency || "CNY") },
    { title: "备注", dataIndex: "remark", render: (value) => value || "-" },
  ];

  const costColumns: ColumnsType<OrderCostRecord> = [
    { title: "成本类型", dataIndex: "costType", width: 220, render: costTypeLabel },
    { title: "金额", dataIndex: "amount", width: 150, align: "right", render: (value, row) => moneyText(value, row.currency || order?.currency) },
    { title: "汇率", dataIndex: "exchangeRate", width: 120, align: "right" },
    { title: "本位币金额", dataIndex: "baseAmount", width: 150, align: "right", render: (value) => moneyText(value, order?.baseCurrency || "CNY") },
    { title: "备注", dataIndex: "remark", render: (value) => value || "-" },
  ];

  const canEditCurrentOrder =
    currentRole === "admin" ||
    (currentRole === "sales" &&
      Boolean(currentUserId && order && (order.createdBy === currentUserId || order.salespersonId === currentUserId)) &&
      Boolean(order && !["completed", "cancelled", "refunded"].includes(order.orderStatus)));

  if (!order && !loading) return <Empty description="订单不存在或已被删除" />;

  return (
    <Spin spinning={loading}>
      {order ? (
        <div className="max-w-full overflow-hidden">
          <Card className="mb-4" styles={{ body: { padding: 20 } }}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <Space className="mb-2" wrap>
                  <Typography.Title level={3} className="!mb-0 !text-[var(--foreground)]">{order.orderNo}</Typography.Title>
                  <StatusTag type="order" value={order.orderStatus} />
                  <StatusTag type="payment" value={order.paymentStatus} />
                  <StatusTag type="shipping" value={order.shippingStatus} />
                </Space>
                <div className="text-sm text-[var(--muted)]">{optionLabel(orderSourceOptions, order.orderSource)} · {order.customerName || order.customer?.name || "散客/平台订单"}</div>
              </div>
              <Space>
                <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/orders")}>返回</Button>
                {canEditCurrentOrder ? <Button type="primary" icon={<EditOutlined />} loading={optionsLoading} onClick={openEditModal}>编辑</Button> : null}
                {["admin", "finance"].includes(currentRole) ? <Button onClick={() => setCostModalOpen(true)}>编辑成本</Button> : null}
              </Space>
            </div>
            <Descriptions bordered size="small" column={{ xs: 1, md: 2, xl: 4 }}>
              <Descriptions.Item label="外部订单号">{order.externalOrderNo || "-"}</Descriptions.Item>
              <Descriptions.Item label="客户名称">{order.customerName || order.customer?.name || "-"}</Descriptions.Item>
              <Descriptions.Item label="业务员">{order.salesperson?.name ?? order.creator?.name ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="下单日期">{formatDate(order.orderDate)}</Descriptions.Item>
              <Descriptions.Item label="销售总金额">{moneyText(order.salesAmount, order.currency)}</Descriptions.Item>
              <Descriptions.Item label="总成本">{moneyText(order.totalCost, order.baseCurrency)}</Descriptions.Item>
              <Descriptions.Item label="毛利"><span className={Number(order.grossProfit) < 0 ? "font-semibold text-red-500" : "font-semibold text-[var(--chart-blue)]"}>{moneyText(order.grossProfit, order.baseCurrency)}</span></Descriptions.Item>
              <Descriptions.Item label="毛利率"><MarginTag value={order.grossMargin} /></Descriptions.Item>
              <Descriptions.Item label="已收金额">{moneyText(order.paidAmount, order.currency)}</Descriptions.Item>
              <Descriptions.Item label="未收金额"><span className={Number(order.unpaidAmount) > 0 ? "font-semibold text-orange-500" : ""}>{moneyText(order.unpaidAmount, order.currency)}</span></Descriptions.Item>
              <Descriptions.Item label="应收款到期"><PaymentDueText value={order.dueDate} unpaidAmount={Number(order.unpaidAmount)} orderStatus={order.orderStatus} /></Descriptions.Item>
              <Descriptions.Item label="国家">{order.countryCode || "-"}</Descriptions.Item>
              <Descriptions.Item label="汇率">{Number(order.exchangeRate).toFixed(6)} · {order.currency}/{order.baseCurrency}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Row gutter={[12, 12]} className="mb-4">
            {[
              ["销售总金额", order.salesAmount, order.currency, "var(--chart-blue)"],
              ["总成本", order.totalCost, order.baseCurrency, "var(--muted)"],
              ["订单毛利", order.grossProfit, order.baseCurrency, Number(order.grossProfit) < 0 ? "var(--danger)" : "var(--success)"],
              ["毛利率", order.grossMargin == null ? "-" : `${(Number(order.grossMargin) * 100).toFixed(2)}%`, null, marginColor(Number(order.grossMargin), Number(order.grossProfit))],
              ["已收金额", order.paidAmount, order.currency, "var(--success)"],
              ["未收金额", order.unpaidAmount, order.currency, Number(order.unpaidAmount) > 0 ? "var(--warning)" : "var(--muted)"],
            ].map(([title, value, cardCurrency, color]) => (
              <Col xs={24} sm={12} lg={8} xl={4} key={String(title)}>
                <Card styles={{ body: { padding: 16 } }}>
                  <Statistic title={String(title)} value={typeof value === "number" ? compactMoneyText(value, String(cardCurrency)) : String(value)} valueStyle={{ color: String(color), fontSize: 22 }} />
                </Card>
              </Col>
            ))}
          </Row>

          <Card>
            <Tabs
              items={[
                {
                  key: "info",
                  label: "订单信息",
                  children: (
                    <div className="space-y-4">
                      <Descriptions bordered column={{ xs: 1, md: 2 }}>
                        <Descriptions.Item label="品牌">{order.brand?.name ?? "-"}</Descriptions.Item>
                        <Descriptions.Item label="平台">{order.platform?.name ?? "-"}</Descriptions.Item>
                        <Descriptions.Item label="店铺/站点">{order.store?.name ?? "-"}</Descriptions.Item>
                        <Descriptions.Item label="来源渠道">{channelLabel(order.channel)}</Descriptions.Item>
                        <Descriptions.Item label="关联红人">
                          {order.influencerCollaboration
                            ? `${order.influencerCollaboration.influencerName}${order.influencerCollaboration.accountHandle ? ` / ${order.influencerCollaboration.accountHandle}` : ""}`
                            : "-"}
                        </Descriptions.Item>
                        <Descriptions.Item label="币种">{order.currency}</Descriptions.Item>
                        <Descriptions.Item label="收款方式">{order.paymentMethod || "-"}</Descriptions.Item>
                        <Descriptions.Item label="出货日期">{formatDate(order.shipmentDate)}</Descriptions.Item>
                        <Descriptions.Item label="预计发货">{formatDate(order.expectedShipDate)}</Descriptions.Item>
                        <Descriptions.Item label="实际发货">{formatDate(order.actualShipDate)}</Descriptions.Item>
                        <Descriptions.Item label="物流商">{order.logisticsProvider || "-"}</Descriptions.Item>
                        <Descriptions.Item label="物流单号">{order.trackingNo || "-"}</Descriptions.Item>
                        <Descriptions.Item label="创建时间">{formatDateTime(order.createdAt)}</Descriptions.Item>
                        <Descriptions.Item label="更新时间">{formatDateTime(order.updatedAt)}</Descriptions.Item>
                        <Descriptions.Item label="备注" span={2}>{order.remark || "-"}</Descriptions.Item>
                      </Descriptions>
                      <Card title="附件资料" size="small" styles={{ body: { padding: 16 } }}>
                        <Typography.Paragraph type="secondary" className="!mb-3">
                          可上传提单、装箱单、报关单、物流单、付款凭证、聊天记录等订单资料。
                        </Typography.Paragraph>
                        <OrderAttachmentPanel orderId={order.id} />
                      </Card>
                    </div>
                  ),
                },
                {
                  key: "items",
                  label: "商品明细",
                  children: <Table rowKey={(row) => String(row.id ?? row.productName)} columns={itemColumns} dataSource={order.items ?? []} pagination={false} scroll={{ x: 1880 }} />,
                },
                {
                  key: "costs",
                  label: "成本分项",
                  children: <Table rowKey={(row) => row.costType} columns={costColumns} dataSource={order.costs ?? []} pagination={false} scroll={{ x: 760 }} />,
                },
                { key: "source", label: "来源信息", children: <OrderSourcePanel order={order} /> },
                { key: "statusLogs", label: "状态记录", children: <OrderStatusLogPanel orderId={order.id} currentStatus={order.orderStatus} logs={order.statusLogs ?? []} canWrite={canEditCurrentOrder} onChanged={loadOrder} /> },
                { key: "attachments", label: "附件资料", children: <OrderAttachmentPanel orderId={order.id} /> },
                { key: "payments", label: "收款记录", children: <OrderPaymentPanel order={order} canWrite={["admin", "finance"].includes(currentRole)} onChanged={loadOrder} /> },
                { key: "shipments", label: "发货记录", children: <OrderShipmentPanel order={order} canWrite={canEditCurrentOrder} onChanged={loadOrder} /> },
              ]}
            />
          </Card>

          {modalOpen ? (
            <OrderFormModal
              key={`detail-edit-${order.id}`}
              open={modalOpen}
              saving={saving}
              editing={order}
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
              canEditCosts={["admin", "finance"].includes(currentRole)}
              onCancel={() => setModalOpen(false)}
              onSubmit={saveOrder}
            />
          ) : null}
          {costModalOpen ? (
            <OrderCostModal
              open={costModalOpen}
              saving={costSaving}
              order={order}
              onCancel={() => setCostModalOpen(false)}
              onSubmit={saveCosts}
            />
          ) : null}
        </div>
      ) : null}
    </Spin>
  );
}
