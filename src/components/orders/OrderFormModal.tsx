"use client";

import { Alert, Button, Card, DatePicker, Divider, Form, Input, InputNumber, Modal, Select, Typography, message } from "antd";
import dayjs from "dayjs";
import OrderAttachmentPanel from "./OrderAttachmentPanel";
import OrderCostEditor, { buildCostRows } from "./OrderCostEditor";
import OrderItemsEditor from "./OrderItemsEditor";
import {
  channelLabel,
  moneyValue,
  marginColor,
  orderSourceOptions,
  orderStatusOptions,
  paymentStatusFor,
  paymentStatusOptions,
  shippingStatusOptions,
  percentText,
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

type Props = {
  open: boolean;
  saving: boolean;
  editing?: OrderRecord | null;
  brands: BrandOption[];
  platforms: PlatformOption[];
  stores: StoreOption[];
  channels: ChannelOption[];
  influencers: InfluencerOption[];
  countries: CountryOption[];
  currencies: CurrencyOption[];
  customers: CustomerOption[];
  users: UserOption[];
  products: ProductOption[];
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void;
};

function dayValue(value?: string | Date | null) {
  return value ? dayjs(value) : null;
}

function defaultCosts(currency = "USD") {
  return ["product_purchase", "domestic_shipping", "packaging_material", "international_shipping", "customs_fee", "port_charge", "trucking_fee", "platform_fee", "payment_fee", "other"].map((costType) => ({ costType, amount: 0, currency, exchangeRate: 1 }));
}

export function orderToFormValues(order?: OrderRecord | null) {
  if (!order) {
    return {
      orderSource: "manual",
      currency: "USD",
      exchangeRate: 1,
      baseCurrency: "CNY",
      orderDate: dayjs(),
      salesAmount: 0,
      paidAmount: 0,
      unpaidAmount: 0,
      orderStatus: "pending_payment",
      paymentStatus: "unpaid",
      shippingStatus: "unshipped",
      items: [{ productName: "", quantity: 1, saleUnitPrice: 0, purchaseUnitCost: 0, packagingUnitCost: 0 }],
      costs: defaultCosts("USD"),
    };
  }
  return {
    ...order,
    orderDate: dayValue(order.orderDate),
    shipmentDate: dayValue(order.shipmentDate),
    dueDate: dayValue(order.dueDate),
    items: order.items?.length ? order.items.map((item) => ({ ...item, quantity: moneyValue(item.quantity), saleUnitPrice: moneyValue(item.saleUnitPrice ?? item.unitPrice), purchaseUnitCost: moneyValue(item.purchaseUnitCost ?? item.costPrice), packagingUnitCost: moneyValue(item.packagingUnitCost) })) : [{ productName: "", quantity: 1, saleUnitPrice: 0, purchaseUnitCost: 0, packagingUnitCost: 0 }],
    costs: order.costs?.length ? order.costs.map((cost) => ({ ...cost, amount: moneyValue(cost.amount), exchangeRate: moneyValue(cost.exchangeRate) || 1, baseAmount: moneyValue(cost.baseAmount) })) : defaultCosts(order.currency),
  };
}

function serializeDate(value: unknown) {
  return value && typeof value === "object" && "toISOString" in value ? (value as dayjs.Dayjs).toISOString() : null;
}

function calculate(values: Record<string, unknown>) {
  const items = Array.isArray(values.items) ? values.items : [];
  const itemTotals = items.reduce(
    (summary, item) => {
      const row = item as Record<string, unknown>;
      const quantity = moneyValue(row.quantity);
      return {
        salesAmount: summary.salesAmount + quantity * moneyValue(row.saleUnitPrice),
        productPurchase: summary.productPurchase + quantity * moneyValue(row.purchaseUnitCost),
        packaging: summary.packaging + quantity * moneyValue(row.packagingUnitCost),
      };
    },
    { salesAmount: 0, productPurchase: 0, packaging: 0 },
  );
  const costs = Array.isArray(values.costs) ? values.costs : [];
  const otherCost = costs.reduce((sum, cost) => {
    const row = cost as Record<string, unknown>;
    if (["product_purchase", "packaging_material"].includes(String(row.costType))) return sum;
    return sum + moneyValue(row.amount);
  }, 0);
  const salesAmount = Number(itemTotals.salesAmount.toFixed(2));
  const totalCost = Number((itemTotals.productPurchase + itemTotals.packaging + otherCost).toFixed(2));
  const grossProfit = Number((salesAmount - totalCost).toFixed(2));
  const grossMargin = salesAmount > 0 ? grossProfit / salesAmount : null;
  const paidAmount = moneyValue(values.paidAmount);
  const unpaidAmount = Math.max(salesAmount - paidAmount, 0);
  const orderStatus = String(values.orderStatus || "pending_payment");
  return { salesAmount, productPurchase: itemTotals.productPurchase, packaging: itemTotals.packaging, totalCost, grossProfit, grossMargin, paidAmount, unpaidAmount, paymentStatus: paymentStatusFor(salesAmount, paidAmount, orderStatus) };
}

export function serializeOrderForm(values: Record<string, unknown>, formCosts: Record<string, unknown>[]) {
  return {
    ...values,
    orderDate: serializeDate(values.orderDate),
    shipmentDate: serializeDate(values.shipmentDate),
    dueDate: serializeDate(values.dueDate),
    actualShipDate: serializeDate(values.shipmentDate),
    costs: formCosts,
  };
}

function isInfluencerChannel(channel?: ChannelOption | null) {
  if (!channel) return false;
  const text = `${channel.channelType ?? ""} ${channel.businessLine ?? ""} ${channel.channelName ?? ""}`.toLowerCase();
  return text.includes("influencer") || text.includes("红人") || text.includes("达人");
}

function influencerLabel(item: InfluencerOption) {
  return `${item.influencerName}${item.accountHandle ? ` / ${item.accountHandle}` : ""} (${item.platform})`;
}

export default function OrderFormModal({ open, saving, editing, brands, platforms, stores, channels, influencers, countries, currencies, customers, users, products, onCancel, onSubmit }: Props) {
  const [form] = Form.useForm();
  const values = Form.useWatch([], form) ?? {};
  const currency = String((values as Record<string, unknown>).currency || "USD");
  const selectedChannelId = Number((values as Record<string, unknown>).channelId || 0);
  const selectedBrandId = Number((values as Record<string, unknown>).brandId || 0);
  const selectedChannel = channels.find((item) => item.id === selectedChannelId);
  const showInfluencerSelect = isInfluencerChannel(selectedChannel);
  const influencerOptions = influencers
    .filter((item) => item.status !== "cancelled")
    .filter((item) => !selectedChannelId || !item.channelId || item.channelId === selectedChannelId)
    .filter((item) => !selectedBrandId || !item.brandId || item.brandId === selectedBrandId)
    .map((item) => ({ label: influencerLabel(item), value: item.id }));
  const computed = calculate(values as Record<string, unknown>);

  function syncComputed() {
    const nextCosts = buildCostRows(form, currency);
    const next = calculate({ ...form.getFieldsValue(true), costs: nextCosts });
    form.setFieldsValue({ salesAmount: next.salesAmount, totalAmount: next.salesAmount, productAmount: next.salesAmount, totalCost: next.totalCost, grossProfit: next.grossProfit, grossMargin: next.grossMargin, unpaidAmount: next.unpaidAmount, paymentStatus: next.paymentStatus, costs: nextCosts });
  }

  function applyCustomer(customerId?: number) {
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) return;
    form.setFieldsValue({ customerName: customer.name, countryCode: form.getFieldValue("countryCode") ?? customer.countryCode, brandId: form.getFieldValue("brandId") ?? customer.brandId, channelId: form.getFieldValue("channelId") ?? customer.sourceChannelId });
  }

  function applyStore(storeId?: number) {
    const store = stores.find((item) => item.id === storeId);
    if (!store) return;
    form.setFieldsValue({ brandId: store.brandId, platformId: store.platformId, currency: store.defaultCurrency ?? form.getFieldValue("currency") ?? "USD", countryCode: form.getFieldValue("countryCode") ?? store.primaryMarketCode });
  }

  function applyChannel(channelId?: number) {
    const channel = channels.find((item) => item.id === channelId);
    if (!isInfluencerChannel(channel)) form.setFieldsValue({ influencerCollaborationId: null });
  }

  async function fetchReferenceRate() {
    const from = String(form.getFieldValue("currency") || "USD");
    const to = String(form.getFieldValue("baseCurrency") || "CNY");
    try {
      const response = await fetch(`/api/exchange-rates/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const data = (await response.json()) as { rate?: number; source?: string; message?: string };
      if (!response.ok || !data.rate) throw new Error(data.message || "暂未获取到参考汇率");
      form.setFieldsValue({ exchangeRate: data.rate });
      queueMicrotask(syncComputed);
      message.success(`已获取参考汇率：${from}/${to} = ${Number(data.rate).toFixed(6)}`);
    } catch (error) {
      message.warning(error instanceof Error ? error.message : "暂未获取到参考汇率，请手动填写");
    }
  }

  return (
    <Modal
      title={editing ? `编辑订单 ${editing.orderNo}` : "新增订单"}
      open={open}
      width="90vw"
      style={{ minWidth: 1100, maxWidth: 1400 }}
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
      onCancel={onCancel}
      destroyOnHidden
      afterOpenChange={(visible) => {
        if (visible) {
          form.resetFields();
          form.setFieldsValue(orderToFormValues(editing));
          queueMicrotask(syncComputed);
        } else {
          form.resetFields();
        }
      }}
      onOk={async () => {
        syncComputed();
        const nextValues = await form.validateFields();
        await onSubmit(serializeOrderForm({ ...nextValues, ...calculate(nextValues) }, buildCostRows(form, String(nextValues.currency || "USD"))));
      }}
    >
      <Form form={form} layout="vertical" preserve={false} initialValues={orderToFormValues(editing)} onValuesChange={() => queueMicrotask(syncComputed)}>
        <Divider titlePlacement="start">订单基础信息</Divider>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3 xl:grid-cols-4">
          <Form.Item name="orderNo" label="订单编号"><Input placeholder="自动生成，可手动改" /></Form.Item>
          <Form.Item name="orderSource" label="订单来源"><Select options={orderSourceOptions} /></Form.Item>
          <Form.Item name="customerId" label="客户"><Select allowClear showSearch optionFilterProp="label" options={customers.map((item) => ({ label: `${item.name}${item.companyName ? ` / ${item.companyName}` : ""}`, value: item.id }))} onChange={applyCustomer} /></Form.Item>
          <Form.Item name="customerName" label="客户名称" rules={[{ required: true, message: "请输入客户名称" }]}><Input /></Form.Item>
          <Form.Item name="salespersonId" label="业务员"><Select allowClear showSearch optionFilterProp="label" options={users.filter((item) => item.role === "sales" || !item.role).map((item) => ({ label: item.name, value: item.id }))} /></Form.Item>
          <Form.Item name="brandId" label="品牌"><Select allowClear showSearch optionFilterProp="label" options={brands.map((item) => ({ label: item.name, value: item.id }))} /></Form.Item>
          <Form.Item name="platformId" label="平台"><Select allowClear showSearch optionFilterProp="label" options={platforms.map((item) => ({ label: item.name, value: item.id }))} /></Form.Item>
          <Form.Item name="storeId" label="店铺/站点"><Select allowClear showSearch optionFilterProp="label" options={stores.map((item) => ({ label: item.name, value: item.id }))} onChange={applyStore} /></Form.Item>
          <Form.Item name="channelId" label="渠道"><Select allowClear showSearch optionFilterProp="label" options={channels.map((item) => ({ label: channelLabel(item), value: item.id }))} onChange={applyChannel} /></Form.Item>
          {showInfluencerSelect ? (
            <Form.Item name="influencerCollaborationId" label="关联红人">
              <Select allowClear showSearch optionFilterProp="label" placeholder="从红人合作模块选择已维护的达人" options={influencerOptions} />
            </Form.Item>
          ) : null}
          <Form.Item name="countryCode" label="国家"><Select allowClear showSearch optionFilterProp="label" options={countries.map((item) => ({ label: `${item.name} (${item.code})`, value: item.code }))} /></Form.Item>
          <Form.Item name="currency" label="订单币种"><Select options={currencies.map((item) => ({ label: item.code, value: item.code }))} /></Form.Item>
          <Form.Item label="汇率">
            <div className="flex gap-2">
              <Form.Item name="exchangeRate" noStyle><InputNumber min={0.000001} precision={6} className="!w-full" /></Form.Item>
              <Button onClick={fetchReferenceRate}>获取参考汇率</Button>
            </div>
          </Form.Item>
          <Form.Item name="baseCurrency" label="本位币"><Select options={["CNY", "USD", "EUR", "JPY", "GBP"].map((value) => ({ label: value, value }))} /></Form.Item>
          <Form.Item name="orderDate" label="下单日期" rules={[{ required: true, message: "请选择下单日期" }]}><DatePicker className="w-full" /></Form.Item>
          <Form.Item name="shipmentDate" label="出货日期"><DatePicker className="w-full" /></Form.Item>
          <Form.Item name="paymentMethod" label="收款方式"><Input placeholder="PayPal / 银行 / 平台" /></Form.Item>
          <Form.Item name="dueDate" label="应收款到期"><DatePicker className="w-full" /></Form.Item>
          <Form.Item name="orderStatus" label="订单状态"><Select options={orderStatusOptions.map(({ label, value }) => ({ label, value }))} /></Form.Item>
          <Form.Item name="paymentStatus" label="付款状态"><Select options={paymentStatusOptions.map(({ label, value }) => ({ label, value }))} /></Form.Item>
          <Form.Item name="shippingStatus" label="发货状态"><Select options={shippingStatusOptions.map(({ label, value }) => ({ label, value }))} /></Form.Item>
          <Form.Item name="paidAmount" label="已收金额"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
          <Form.Item name="statusRemark" label="状态备注" className="md:col-span-2"><Input placeholder="订单状态变化时记录备注，例如客户已确认尾款、已安排出货" /></Form.Item>
          <div className="md:col-span-3 xl:col-span-4">
            <Card size="small" title="附件资料" styles={{ body: { padding: 16 } }}>
              {editing?.id ? (
                <>
                  <Typography.Paragraph type="secondary" className="!mb-3">
                    可上传提单、装箱单、报关单、物流单、付款凭证、聊天记录等订单资料。
                  </Typography.Paragraph>
                  <OrderAttachmentPanel orderId={editing.id} />
                </>
              ) : (
                <Alert type="info" showIcon message="请先保存订单，保存成功后再进入编辑上传附件。" />
              )}
            </Card>
          </div>
        </div>

        <Divider titlePlacement="start">商品明细</Divider>
        <OrderItemsEditor form={form} products={products} />

        <Divider titlePlacement="start">成本分项</Divider>
        <OrderCostEditor form={form} currency={currency} />

        <Divider titlePlacement="start">利润计算结果</Divider>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            { title: "销售总金额", value: `${currency} ${computed.salesAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "var(--chart-blue)" },
            { title: "全部成本合计", value: `${currency} ${computed.totalCost.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "var(--muted)" },
            { title: "订单毛利", value: `${currency} ${computed.grossProfit.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: computed.grossProfit < 0 ? "var(--danger)" : "var(--success)" },
            { title: "毛利率", value: percentText(computed.grossMargin), color: marginColor(computed.grossMargin, computed.grossProfit) },
          ].map((card) => (
            <div key={card.title} className="flex min-h-[112px] flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="text-sm text-[var(--muted)]">{card.title}</div>
              <div className="text-2xl font-semibold leading-8" style={{ color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>

        <Divider titlePlacement="start">订单备注</Divider>
        <Form.Item name="remark" label="订单备注">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
