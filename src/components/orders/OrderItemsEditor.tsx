"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Form, Input, InputNumber, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { FormInstance } from "antd";
import { moneyValue, type ProductOption } from "./orderOptions";

type Props = {
  form: FormInstance;
  products: ProductOption[];
  currencies: string[];
  baseCurrency?: string;
  orderCurrency?: string;
  orderExchangeRate?: number;
};

type FieldRow = { key: number; name: number };

function rowValue(form: FormInstance, rowIndex: number, key: string) {
  const item = form.getFieldValue(["items", rowIndex]) as Record<string, unknown> | undefined;
  return moneyValue(item?.[key]);
}

function rowSubtotal(form: FormInstance, rowIndex: number, unitKey: string) {
  return (rowValue(form, rowIndex, "quantity") * rowValue(form, rowIndex, unitKey)).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rowBaseSubtotal(form: FormInstance, rowIndex: number, unitKey: string, exchangeRateKey: string) {
  const subtotal = rowValue(form, rowIndex, "quantity") * rowValue(form, rowIndex, unitKey);
  const exchangeRate = rowValue(form, rowIndex, exchangeRateKey) || 1;
  return (subtotal * exchangeRate).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function defaultRateForCurrency(rowCurrency: string | undefined, baseCurrency: string, orderCurrency: string, orderExchangeRate: number, fallbackRate: unknown) {
  const currency = rowCurrency || baseCurrency;
  if (currency === baseCurrency) return 1;
  if (currency === orderCurrency && orderExchangeRate > 1) return orderExchangeRate;
  return moneyValue(fallbackRate) || 1;
}

export default function OrderItemsEditor({ form, products, currencies, baseCurrency = "CNY", orderCurrency = "USD", orderExchangeRate = 1 }: Props) {
  const watchedItems = Form.useWatch("items", form) as Record<string, unknown>[] | undefined;
  const currentItems = (watchedItems ?? form.getFieldValue("items") ?? []) as Record<string, unknown>[];
  const currencyOptions = Array.from(new Set([baseCurrency, ...currencies, "CNY", "USD", "EUR", "JPY", "GBP"].filter(Boolean))).map((currency) => ({ label: currency, value: currency }));

  function applyProduct(rowIndex: number, productId?: number) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const currentItems = form.getFieldValue("items") as Record<string, unknown>[];
    const nextItems = [...(currentItems ?? [])];
    nextItems[rowIndex] = {
      ...nextItems[rowIndex],
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      specification: product.specification,
      purchaseUnitCost: moneyValue(product.defaultPurchasePrice),
      purchaseCurrency: product.currency || "CNY",
      purchaseExchangeRate: defaultRateForCurrency(product.currency, baseCurrency, orderCurrency, orderExchangeRate, nextItems[rowIndex]?.purchaseExchangeRate),
      packagingUnitCost: moneyValue(product.defaultPackagingCost),
      packagingCurrency: "CNY",
      packagingExchangeRate: 1,
    };
    form.setFieldsValue({ items: nextItems });
  }

  function addRow() {
    const currentItems = (form.getFieldValue("items") ?? []) as Record<string, unknown>[];
    form.setFieldValue("items", [...currentItems, { quantity: 1, saleUnitPrice: 0, purchaseUnitCost: 0, purchaseCurrency: "CNY", purchaseExchangeRate: 1, packagingUnitCost: 0, packagingCurrency: "CNY", packagingExchangeRate: 1 }]);
  }

  function removeRow(rowIndex: number) {
    const currentItems = (form.getFieldValue("items") ?? []) as Record<string, unknown>[];
    if (currentItems.length <= 1) return;
    form.setFieldValue("items", currentItems.filter((_, index) => index !== rowIndex));
  }

  const rows = Array.from({ length: Math.max(currentItems.length, 1) }, (_, index) => ({ key: index, name: index }));
  const columns: ColumnsType<FieldRow> = [
    {
      title: "选择产品",
      width: 190,
      render: (_, field) => (
        <Form.Item name={["items", field.name, "productId"]} className="!mb-0">
          <Select allowClear showSearch optionFilterProp="label" placeholder="选择产品" options={products.map((item) => ({ label: `${item.sku} / ${item.name}`, value: item.id }))} onChange={(value) => applyProduct(field.name, value)} />
        </Form.Item>
      ),
    },
    { title: "SKU", width: 150, render: (_, field) => <Form.Item name={["items", field.name, "sku"]} className="!mb-0"><Input placeholder="SKU" /></Form.Item> },
    { title: "产品名称", width: 260, render: (_, field) => <Form.Item name={["items", field.name, "productName"]} className="!mb-0" rules={[{ required: true, message: "请输入商品名称" }]}><Input placeholder="商品名称" /></Form.Item> },
    { title: "规格", width: 180, render: (_, field) => <Form.Item name={["items", field.name, "specification"]} className="!mb-0"><Input placeholder="规格" /></Form.Item> },
    { title: "数量", width: 100, align: "right", render: (_, field) => <Form.Item name={["items", field.name, "quantity"]} className="!mb-0" rules={[{ required: true, message: "数量必填" }]}><InputNumber min={1} precision={0} className="!w-full text-right" /></Form.Item> },
    { title: "销售单价", width: 120, align: "right", render: (_, field) => <Form.Item name={["items", field.name, "saleUnitPrice"]} className="!mb-0" rules={[{ required: true, message: "销售单价必填" }]}><InputNumber min={0} precision={2} className="!w-full text-right" /></Form.Item> },
    { title: "销售小计", width: 130, align: "right", render: (_, field) => <Form.Item shouldUpdate noStyle>{() => <div className="text-right font-medium text-[var(--foreground)]">{rowSubtotal(form, field.name, "saleUnitPrice")}</div>}</Form.Item> },
    { title: "采购单价", width: 120, align: "right", render: (_, field) => <Form.Item name={["items", field.name, "purchaseUnitCost"]} className="!mb-0"><InputNumber min={0} precision={2} className="!w-full text-right" /></Form.Item> },
    { title: "采购币种", width: 110, render: (_, field) => <Form.Item name={["items", field.name, "purchaseCurrency"]} className="!mb-0"><Select options={currencyOptions} onChange={(nextCurrency) => form.setFieldValue(["items", field.name, "purchaseExchangeRate"], defaultRateForCurrency(nextCurrency, baseCurrency, orderCurrency, orderExchangeRate, form.getFieldValue(["items", field.name, "purchaseExchangeRate"])))} /></Form.Item> },
    { title: "采购汇率", width: 110, align: "right", render: (_, field) => <Form.Item name={["items", field.name, "purchaseExchangeRate"]} className="!mb-0"><InputNumber min={0.000001} precision={6} className="!w-full text-right" /></Form.Item> },
    { title: "采购小计", width: 130, align: "right", render: (_, field) => <Form.Item shouldUpdate noStyle>{() => <div className="text-right text-[var(--muted)]">{rowSubtotal(form, field.name, "purchaseUnitCost")}</div>}</Form.Item> },
    { title: "采购本位币", width: 130, align: "right", render: (_, field) => <Form.Item shouldUpdate noStyle>{() => <div className="text-right text-[var(--muted)]">{baseCurrency} {rowBaseSubtotal(form, field.name, "purchaseUnitCost", "purchaseExchangeRate")}</div>}</Form.Item> },
    { title: "包装单价", width: 120, align: "right", render: (_, field) => <Form.Item name={["items", field.name, "packagingUnitCost"]} className="!mb-0"><InputNumber min={0} precision={2} className="!w-full text-right" /></Form.Item> },
    { title: "包装币种", width: 110, render: (_, field) => <Form.Item name={["items", field.name, "packagingCurrency"]} className="!mb-0"><Select options={currencyOptions} onChange={(nextCurrency) => form.setFieldValue(["items", field.name, "packagingExchangeRate"], defaultRateForCurrency(nextCurrency, baseCurrency, orderCurrency, orderExchangeRate, form.getFieldValue(["items", field.name, "packagingExchangeRate"])))} /></Form.Item> },
    { title: "包装汇率", width: 110, align: "right", render: (_, field) => <Form.Item name={["items", field.name, "packagingExchangeRate"]} className="!mb-0"><InputNumber min={0.000001} precision={6} className="!w-full text-right" /></Form.Item> },
    { title: "包装小计", width: 130, align: "right", render: (_, field) => <Form.Item shouldUpdate noStyle>{() => <div className="text-right text-[var(--muted)]">{rowSubtotal(form, field.name, "packagingUnitCost")}</div>}</Form.Item> },
    { title: "包装本位币", width: 130, align: "right", render: (_, field) => <Form.Item shouldUpdate noStyle>{() => <div className="text-right text-[var(--muted)]">{baseCurrency} {rowBaseSubtotal(form, field.name, "packagingUnitCost", "packagingExchangeRate")}</div>}</Form.Item> },
    {
      title: "操作",
      width: 72,
      fixed: "right",
      align: "center",
      render: (_, field) => <Button danger type="text" icon={<DeleteOutlined />} disabled={rows.length <= 1} onClick={() => removeRow(field.name)} />,
    },
  ];

  return (
    <div className="space-y-3">
      <Table<FieldRow>
        rowKey="key"
        size="small"
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 2260 }}
        className="[&_.ant-table-cell]:!align-top"
      />
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addRow}>添加商品明细</Button>
    </div>
  );
}
