"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Form, Input, InputNumber, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { FormInstance } from "antd";
import { moneyValue, type ProductOption } from "./orderOptions";

type Props = {
  form: FormInstance;
  products: ProductOption[];
};

type FieldRow = { key: number; name: number };

function rowValue(form: FormInstance, rowIndex: number, key: string) {
  const item = form.getFieldValue(["items", rowIndex]) as Record<string, unknown> | undefined;
  return moneyValue(item?.[key]);
}

function rowSubtotal(form: FormInstance, rowIndex: number, unitKey: string) {
  return (rowValue(form, rowIndex, "quantity") * rowValue(form, rowIndex, unitKey)).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OrderItemsEditor({ form, products }: Props) {
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
      packagingUnitCost: moneyValue(product.defaultPackagingCost),
    };
    form.setFieldsValue({ items: nextItems });
  }

  return (
    <Form.List name="items">
      {(fields, { add, remove }) => {
        const rows = fields.map((field) => ({ key: field.key, name: field.name }));
        const columns: ColumnsType<FieldRow> = [
          {
            title: "选择产品",
            width: 190,
            render: (_, field) => (
              <Form.Item name={[field.name, "productId"]} className="!mb-0">
                <Select allowClear showSearch optionFilterProp="label" placeholder="选择产品" options={products.map((item) => ({ label: `${item.sku} / ${item.name}`, value: item.id }))} onChange={(value) => applyProduct(field.name, value)} />
              </Form.Item>
            ),
          },
          { title: "SKU", width: 150, render: (_, field) => <Form.Item name={[field.name, "sku"]} className="!mb-0"><Input placeholder="SKU" /></Form.Item> },
          { title: "产品名称", width: 260, render: (_, field) => <Form.Item name={[field.name, "productName"]} className="!mb-0" rules={[{ required: true, message: "请输入商品名称" }]}><Input placeholder="商品名称" /></Form.Item> },
          { title: "规格", width: 180, render: (_, field) => <Form.Item name={[field.name, "specification"]} className="!mb-0"><Input placeholder="规格" /></Form.Item> },
          { title: "数量", width: 100, align: "right", render: (_, field) => <Form.Item name={[field.name, "quantity"]} className="!mb-0" rules={[{ required: true, message: "数量必填" }]}><InputNumber min={1} precision={0} className="!w-full text-right" /></Form.Item> },
          { title: "销售单价", width: 120, align: "right", render: (_, field) => <Form.Item name={[field.name, "saleUnitPrice"]} className="!mb-0" rules={[{ required: true, message: "销售单价必填" }]}><InputNumber min={0} precision={2} className="!w-full text-right" /></Form.Item> },
          { title: "销售小计", width: 130, align: "right", render: (_, field) => <Form.Item shouldUpdate noStyle>{() => <div className="text-right font-medium text-[var(--foreground)]">{rowSubtotal(form, field.name, "saleUnitPrice")}</div>}</Form.Item> },
          { title: "采购单价", width: 120, align: "right", render: (_, field) => <Form.Item name={[field.name, "purchaseUnitCost"]} className="!mb-0"><InputNumber min={0} precision={2} className="!w-full text-right" /></Form.Item> },
          { title: "采购小计", width: 130, align: "right", render: (_, field) => <Form.Item shouldUpdate noStyle>{() => <div className="text-right text-[var(--muted)]">{rowSubtotal(form, field.name, "purchaseUnitCost")}</div>}</Form.Item> },
          { title: "包装单价", width: 120, align: "right", render: (_, field) => <Form.Item name={[field.name, "packagingUnitCost"]} className="!mb-0"><InputNumber min={0} precision={2} className="!w-full text-right" /></Form.Item> },
          { title: "包装小计", width: 130, align: "right", render: (_, field) => <Form.Item shouldUpdate noStyle>{() => <div className="text-right text-[var(--muted)]">{rowSubtotal(form, field.name, "packagingUnitCost")}</div>}</Form.Item> },
          {
            title: "操作",
            width: 72,
            fixed: "right",
            align: "center",
            render: (_, field) => <Button danger type="text" icon={<DeleteOutlined />} disabled={fields.length <= 1} onClick={() => remove(field.name)} />,
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
              scroll={{ x: 1600 }}
              className="[&_.ant-table-cell]:!align-top"
            />
            <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ quantity: 1, saleUnitPrice: 0, purchaseUnitCost: 0, packagingUnitCost: 0 })}>添加商品明细</Button>
          </div>
        );
      }}
    </Form.List>
  );
}
