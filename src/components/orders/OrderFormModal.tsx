"use client";

import { DatePicker, Divider, Form, Input, InputNumber, Modal, Select } from "antd";
import dayjs from "dayjs";
import OrderItemsEditor from "./OrderItemsEditor";
import {
  channelLabel,
  moneyText,
  moneyValue,
  orderSourceOptions,
  orderStatusOptions,
  paymentStatusFor,
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

type Props = {
  open: boolean;
  saving: boolean;
  editing?: OrderRecord | null;
  brands: BrandOption[];
  platforms: PlatformOption[];
  stores: StoreOption[];
  channels: ChannelOption[];
  countries: CountryOption[];
  currencies: CurrencyOption[];
  customers: CustomerOption[];
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void;
};

function dayValue(value?: string | Date | null) {
  return value ? dayjs(value) : null;
}

export function orderToFormValues(order?: OrderRecord | null) {
  if (!order) {
    return {
      orderSource: "manual",
      currency: "USD",
      orderDate: dayjs(),
      productAmount: 0,
      shippingFee: 0,
      discountAmount: 0,
      taxAmount: 0,
      otherFee: 0,
      totalAmount: 0,
      paidAmount: 0,
      unpaidAmount: 0,
      orderStatus: "draft",
      paymentStatus: "unpaid",
      shippingStatus: "unshipped",
      items: [{ productName: "", quantity: 1, unitPrice: 0, costPrice: 0 }],
    };
  }
  return {
    ...order,
    orderDate: dayValue(order.orderDate),
    dueDate: dayValue(order.dueDate),
    expectedShipDate: dayValue(order.expectedShipDate),
    actualShipDate: dayValue(order.actualShipDate),
    items: order.items?.length ? order.items.map((item) => ({ ...item, quantity: moneyValue(item.quantity), unitPrice: moneyValue(item.unitPrice), costPrice: item.costPrice == null ? null : moneyValue(item.costPrice) })) : [{ productName: "", quantity: 1, unitPrice: 0, costPrice: 0 }],
  };
}

function serializeDate(value: unknown) {
  return value && typeof value === "object" && "toISOString" in value ? (value as dayjs.Dayjs).toISOString() : null;
}

export function serializeOrderForm(values: Record<string, unknown>) {
  return {
    ...values,
    orderDate: serializeDate(values.orderDate),
    dueDate: serializeDate(values.dueDate),
    expectedShipDate: serializeDate(values.expectedShipDate),
    actualShipDate: serializeDate(values.actualShipDate),
  };
}

function calculate(values: Record<string, unknown>) {
  const items = Array.isArray(values.items) ? values.items : [];
  const productAmount = items.reduce((sum, item) => {
    const row = item as Record<string, unknown>;
    return sum + moneyValue(row.quantity) * moneyValue(row.unitPrice);
  }, 0);
  const shippingFee = moneyValue(values.shippingFee);
  const discountAmount = moneyValue(values.discountAmount);
  const taxAmount = moneyValue(values.taxAmount);
  const otherFee = moneyValue(values.otherFee);
  const totalAmount = Math.max(productAmount + shippingFee + taxAmount + otherFee - discountAmount, 0);
  const paidAmount = moneyValue(values.paidAmount);
  const unpaidAmount = Math.max(totalAmount - paidAmount, 0);
  const orderStatus = String(values.orderStatus || "draft");
  return { productAmount, totalAmount, paidAmount, unpaidAmount, paymentStatus: paymentStatusFor(totalAmount, paidAmount, orderStatus) };
}

export default function OrderFormModal({ open, saving, editing, brands, platforms, stores, channels, countries, currencies, customers, onCancel, onSubmit }: Props) {
  const [form] = Form.useForm();
  const values = Form.useWatch([], form) ?? {};
  const computed = calculate(values as Record<string, unknown>);

  function syncComputed() {
    const next = calculate(form.getFieldsValue(true));
    form.setFieldsValue({
      productAmount: Number(next.productAmount.toFixed(2)),
      totalAmount: Number(next.totalAmount.toFixed(2)),
      unpaidAmount: Number(next.unpaidAmount.toFixed(2)),
      paymentStatus: next.paymentStatus,
    });
  }

  function applyCustomer(customerId?: number) {
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) return;
    form.setFieldsValue({
      countryCode: form.getFieldValue("countryCode") ?? customer.countryCode,
      brandId: form.getFieldValue("brandId") ?? customer.brandId,
      channelId: form.getFieldValue("channelId") ?? customer.sourceChannelId,
    });
  }

  function applyStore(storeId?: number) {
    const store = stores.find((item) => item.id === storeId);
    if (!store) return;
    form.setFieldsValue({
      brandId: store.brandId,
      platformId: store.platformId,
      currency: store.defaultCurrency ?? form.getFieldValue("currency") ?? "USD",
      countryCode: form.getFieldValue("countryCode") ?? store.primaryMarketCode,
    });
  }

  return (
    <Modal
      title={editing ? `编辑订单 ${editing.orderNo}` : "新增订单"}
      open={open}
      width={1120}
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
      onCancel={onCancel}
      destroyOnHidden
      afterOpenChange={(visible) => {
        if (visible) {
          form.setFieldsValue(orderToFormValues(editing));
          queueMicrotask(syncComputed);
        }
      }}
      onOk={async () => {
        syncComputed();
        const nextValues = await form.validateFields();
        await onSubmit(serializeOrderForm({ ...nextValues, ...calculate(nextValues) }));
      }}
    >
      <Form form={form} layout="vertical" initialValues={orderToFormValues(editing)} onValuesChange={(_, allValues) => {
        const next = calculate(allValues);
        form.setFieldsValue({ productAmount: Number(next.productAmount.toFixed(2)), totalAmount: Number(next.totalAmount.toFixed(2)), unpaidAmount: Number(next.unpaidAmount.toFixed(2)), paymentStatus: next.paymentStatus });
      }}>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3">
          <Form.Item name="orderSource" label="订单来源" rules={[{ required: true }]}><Select options={orderSourceOptions} /></Form.Item>
          <Form.Item name="externalOrderNo" label="外部订单号"><Input allowClear /></Form.Item>
          <Form.Item name="customerId" label="客户"><Select allowClear showSearch optionFilterProp="label" options={customers.map((item) => ({ label: `${item.name}${item.companyName ? ` / ${item.companyName}` : ""}`, value: item.id }))} onChange={applyCustomer} /></Form.Item>
          <Form.Item name="brandId" label="所属品牌"><Select allowClear showSearch optionFilterProp="label" options={brands.map((item) => ({ label: item.name, value: item.id }))} /></Form.Item>
          <Form.Item name="platformId" label="平台"><Select allowClear showSearch optionFilterProp="label" options={platforms.map((item) => ({ label: item.name, value: item.id }))} /></Form.Item>
          <Form.Item name="storeId" label="店铺/站点"><Select allowClear showSearch optionFilterProp="label" options={stores.map((item) => ({ label: item.name, value: item.id }))} onChange={applyStore} /></Form.Item>
          <Form.Item name="channelId" label="来源渠道"><Select allowClear showSearch optionFilterProp="label" options={channels.map((item) => ({ label: channelLabel(item), value: item.id }))} /></Form.Item>
          <Form.Item name="countryCode" label="国家/地区"><Select allowClear showSearch optionFilterProp="label" options={countries.map((item) => ({ label: `${item.name} (${item.code})`, value: item.code }))} /></Form.Item>
          <Form.Item name="currency" label="币种" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={currencies.map((item) => ({ label: `${item.code} - ${item.name}`, value: item.code }))} /></Form.Item>
          <Form.Item name="orderDate" label="订单日期" rules={[{ required: true, message: "请选择订单日期" }]}><DatePicker className="w-full" /></Form.Item>
          <Form.Item name="dueDate" label="应收款到期"><DatePicker className="w-full" /></Form.Item>
          <Form.Item name="expectedShipDate" label="预计发货日期"><DatePicker className="w-full" /></Form.Item>
        </div>

        <Divider titlePlacement="start">商品明细</Divider>
        <OrderItemsEditor form={form} />

        <Divider titlePlacement="start">金额与状态</Divider>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-4">
          <Form.Item name="productAmount" label="商品金额"><InputNumber disabled precision={2} className="!w-full" /></Form.Item>
          <Form.Item name="shippingFee" label="运费"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
          <Form.Item name="discountAmount" label="折扣"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
          <Form.Item name="taxAmount" label="税费"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
          <Form.Item name="otherFee" label="其他费用"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
          <Form.Item name="totalAmount" label="订单总金额"><InputNumber disabled precision={2} className="!w-full" /></Form.Item>
          <Form.Item name="paidAmount" label="已收金额"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
          <Form.Item name="unpaidAmount" label="未收金额"><InputNumber disabled precision={2} className="!w-full" /></Form.Item>
          <Form.Item name="orderStatus" label="订单状态"><Select options={orderStatusOptions.map(({ label, value }) => ({ label, value }))} /></Form.Item>
          <Form.Item name="paymentStatus" label="付款状态"><Select options={paymentStatusOptions.map(({ label, value }) => ({ label, value }))} /></Form.Item>
          <Form.Item name="shippingStatus" label="发货状态"><Select options={shippingStatusOptions.map(({ label, value }) => ({ label, value }))} /></Form.Item>
          <Form.Item name="actualShipDate" label="实际发货日期"><DatePicker className="w-full" /></Form.Item>
        </div>

        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item name="logisticsProvider" label="物流商"><Input allowClear /></Form.Item>
          <Form.Item name="trackingNo" label="物流单号"><Input allowClear /></Form.Item>
          <Form.Item name="remark" label="备注" className="md:col-span-2"><Input.TextArea rows={3} /></Form.Item>
        </div>
        <div className="rounded-lg bg-[#fafcff] px-3 py-2 text-right text-sm text-[#667085]">
          当前计算：商品 {moneyText(computed.productAmount)} · 总额 {moneyText(computed.totalAmount)} · 未收 {moneyText(computed.unpaidAmount)}
        </div>
      </Form>
    </Modal>
  );
}
