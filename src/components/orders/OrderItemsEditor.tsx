"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Form, Input, InputNumber, Space } from "antd";
import type { FormInstance } from "antd";
import { moneyValue } from "./orderOptions";

type Props = {
  form: FormInstance;
};

function rowTotal(form: FormInstance, rowIndex: number, key: "totalPrice" | "totalCost") {
  const item = form.getFieldValue(["items", rowIndex]) as Record<string, unknown> | undefined;
  const quantity = moneyValue(item?.quantity);
  const unitValue = key === "totalPrice" ? moneyValue(item?.unitPrice) : moneyValue(item?.costPrice);
  return (quantity * unitValue).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OrderItemsEditor({ form }: Props) {
  return (
    <Form.List name="items">
      {(fields, { add, remove }) => (
        <div className="space-y-3">
          <div className="hidden grid-cols-[120px_minmax(180px,1fr)_90px_110px_110px_120px_120px_minmax(120px,1fr)_48px] gap-2 text-xs text-[#667085] lg:grid">
            <span>SKU</span>
            <span>商品名称</span>
            <span>数量</span>
            <span>售价</span>
            <span>成本价</span>
            <span>销售小计</span>
            <span>成本小计</span>
            <span>备注</span>
            <span />
          </div>
          {fields.map((field) => (
            <div key={field.key} className="grid grid-cols-1 gap-2 rounded-lg border border-[#edf0f5] bg-[#fafcff] p-3 lg:grid-cols-[120px_minmax(180px,1fr)_90px_110px_110px_120px_120px_minmax(120px,1fr)_48px]">
              <Form.Item name={[field.name, "sku"]} className="!mb-0"><Input placeholder="SKU" /></Form.Item>
              <Form.Item name={[field.name, "productName"]} className="!mb-0" rules={[{ required: true, message: "请输入商品名称" }]}><Input placeholder="商品名称" /></Form.Item>
              <Form.Item name={[field.name, "quantity"]} className="!mb-0" rules={[{ required: true, message: "数量必填" }]}><InputNumber min={1} precision={0} className="!w-full" /></Form.Item>
              <Form.Item name={[field.name, "unitPrice"]} className="!mb-0" rules={[{ required: true, message: "售价必填" }]}><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
              <Form.Item name={[field.name, "costPrice"]} className="!mb-0"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
              <Form.Item shouldUpdate noStyle>
                {() => <div className="flex h-8 items-center justify-end rounded-md bg-white px-2 text-sm font-medium">{rowTotal(form, field.name, "totalPrice")}</div>}
              </Form.Item>
              <Form.Item shouldUpdate noStyle>
                {() => <div className="flex h-8 items-center justify-end rounded-md bg-white px-2 text-sm text-[#667085]">{rowTotal(form, field.name, "totalCost")}</div>}
              </Form.Item>
              <Form.Item name={[field.name, "remark"]} className="!mb-0"><Input placeholder="备注" /></Form.Item>
              <Space className="justify-end">
                <Button danger type="text" icon={<DeleteOutlined />} disabled={fields.length <= 1} onClick={() => remove(field.name)} />
              </Space>
            </div>
          ))}
          <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ quantity: 1, unitPrice: 0, costPrice: 0 })}>
            添加商品明细
          </Button>
        </div>
      )}
    </Form.List>
  );
}
