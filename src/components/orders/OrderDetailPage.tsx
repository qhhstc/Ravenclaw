"use client";

import { ArrowLeftOutlined, EditOutlined } from "@ant-design/icons";
import { Button, Card, Descriptions, Empty, Row, Col, Space, Spin, Statistic, Table, Tabs, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OrderFormModal from "./OrderFormModal";
import OrderPaymentPlaceholder from "./OrderPaymentPlaceholder";
import OrderSourcePanel from "./OrderSourcePanel";
import {
  PaymentDueText,
  StatusTag,
  channelLabel,
  compactMoneyText,
  formatDate,
  formatDateTime,
  moneyText,
  optionLabel,
  orderSourceOptions,
  type BrandOption,
  type ChannelOption,
  type CountryOption,
  type CurrencyOption,
  type CustomerOption,
  type OrderItemRecord,
  type OrderRecord,
  type PlatformOption,
  type StoreOption,
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
  const [modalOpen, setModalOpen] = useState(false);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [platforms, setPlatforms] = useState<PlatformOption[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

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
    } catch {
      message.error("基础选项加载失败");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(loadOrder);
    queueMicrotask(loadOptions);
  }, [loadOrder, loadOptions]);

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

  const itemColumns: ColumnsType<OrderItemRecord> = [
    { title: "SKU", dataIndex: "sku", width: 130, render: (value) => value || "-" },
    { title: "商品名称", dataIndex: "productName", width: 220 },
    { title: "数量", dataIndex: "quantity", width: 90, align: "right" },
    { title: "售价", dataIndex: "unitPrice", width: 120, align: "right", render: (value) => moneyText(value, order?.currency) },
    { title: "成本价", dataIndex: "costPrice", width: 120, align: "right", render: (value) => value == null ? "-" : moneyText(value, order?.currency) },
    { title: "销售小计", dataIndex: "totalPrice", width: 130, align: "right", render: (value) => moneyText(value, order?.currency) },
    { title: "成本小计", dataIndex: "totalCost", width: 130, align: "right", render: (value) => moneyText(value, order?.currency) },
    { title: "备注", dataIndex: "remark", render: (value) => value || "-" },
  ];

  if (!order && !loading) return <Empty description="订单不存在或已被删除" />;

  return (
    <Spin spinning={loading}>
      {order ? (
        <div className="max-w-full overflow-hidden">
          <Card className="mb-4" styles={{ body: { padding: 20 } }}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <Space className="mb-2" wrap>
                  <Typography.Title level={3} className="!mb-0 !text-[#172033]">{order.orderNo}</Typography.Title>
                  <StatusTag type="order" value={order.orderStatus} />
                  <StatusTag type="payment" value={order.paymentStatus} />
                  <StatusTag type="shipping" value={order.shippingStatus} />
                </Space>
                <div className="text-sm text-[#667085]">{optionLabel(orderSourceOptions, order.orderSource)} · {order.customer?.name ?? "散客/平台订单"}</div>
              </div>
              <Space>
                <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/orders")}>返回</Button>
                <Button type="primary" icon={<EditOutlined />} onClick={() => setModalOpen(true)}>编辑</Button>
              </Space>
            </div>
            <Descriptions bordered size="small" column={{ xs: 1, md: 2, xl: 4 }}>
              <Descriptions.Item label="外部订单号">{order.externalOrderNo || "-"}</Descriptions.Item>
              <Descriptions.Item label="公司名称">{order.customer?.companyName ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="订单总金额">{moneyText(order.totalAmount, order.currency)}</Descriptions.Item>
              <Descriptions.Item label="已收金额">{moneyText(order.paidAmount, order.currency)}</Descriptions.Item>
              <Descriptions.Item label="未收金额"><span className={Number(order.unpaidAmount) > 0 ? "font-semibold text-orange-500" : ""}>{moneyText(order.unpaidAmount, order.currency)}</span></Descriptions.Item>
              <Descriptions.Item label="下单日期">{formatDate(order.orderDate)}</Descriptions.Item>
              <Descriptions.Item label="应收款到期"><PaymentDueText value={order.dueDate} unpaidAmount={Number(order.unpaidAmount)} orderStatus={order.orderStatus} /></Descriptions.Item>
              <Descriptions.Item label="国家">{order.countryCode || "-"}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Row gutter={[12, 12]} className="mb-4">
            {[
              ["商品金额", order.productAmount],
              ["运费", order.shippingFee],
              ["折扣", order.discountAmount],
              ["税费", order.taxAmount],
              ["其他费用", order.otherFee],
              ["订单总金额", order.totalAmount],
              ["已收金额", order.paidAmount],
              ["未收金额", order.unpaidAmount],
            ].map(([title, value]) => (
              <Col xs={24} sm={12} lg={6} xl={3} key={String(title)}>
                <Card styles={{ body: { padding: 16 } }}><Statistic title={String(title)} value={compactMoneyText(value, order.currency)} /></Card>
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
                    <Descriptions bordered column={{ xs: 1, md: 2 }}>
                      <Descriptions.Item label="品牌">{order.brand?.name ?? "-"}</Descriptions.Item>
                      <Descriptions.Item label="平台">{order.platform?.name ?? "-"}</Descriptions.Item>
                      <Descriptions.Item label="店铺/站点">{order.store?.name ?? "-"}</Descriptions.Item>
                      <Descriptions.Item label="来源渠道">{channelLabel(order.channel)}</Descriptions.Item>
                      <Descriptions.Item label="币种">{order.currency}</Descriptions.Item>
                      <Descriptions.Item label="预计发货">{formatDate(order.expectedShipDate)}</Descriptions.Item>
                      <Descriptions.Item label="实际发货">{formatDate(order.actualShipDate)}</Descriptions.Item>
                      <Descriptions.Item label="物流商">{order.logisticsProvider || "-"}</Descriptions.Item>
                      <Descriptions.Item label="物流单号">{order.trackingNo || "-"}</Descriptions.Item>
                      <Descriptions.Item label="创建时间">{formatDateTime(order.createdAt)}</Descriptions.Item>
                      <Descriptions.Item label="更新时间">{formatDateTime(order.updatedAt)}</Descriptions.Item>
                      <Descriptions.Item label="备注" span={2}>{order.remark || "-"}</Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: "items",
                  label: "商品明细",
                  children: <Table rowKey={(row) => String(row.id ?? row.productName)} columns={itemColumns} dataSource={order.items ?? []} pagination={false} scroll={{ x: 1100 }} />,
                },
                { key: "source", label: "来源信息", children: <OrderSourcePanel order={order} /> },
                { key: "payments", label: "收款记录", children: <OrderPaymentPlaceholder order={order} /> },
              ]}
            />
          </Card>

          <OrderFormModal
            open={modalOpen}
            saving={saving}
            editing={order}
            brands={brands}
            platforms={platforms}
            stores={stores}
            channels={channels}
            countries={countries}
            currencies={currencies}
            customers={customers}
            onCancel={() => setModalOpen(false)}
            onSubmit={saveOrder}
          />
        </div>
      ) : null}
    </Spin>
  );
}
