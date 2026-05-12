"use client";

import { Form, Input, InputNumber } from "antd";
import type { FormInstance } from "antd";
import { costTypeOptions, moneyValue } from "./orderOptions";

type Props = { form: FormInstance; currency: string };

function automaticTotals(form: FormInstance) {
  const items = (form.getFieldValue("items") ?? []) as Record<string, unknown>[];
  let productPurchase = 0;
  let packaging = 0;
  items.forEach((item) => {
    const quantity = moneyValue(item.quantity);
    productPurchase += quantity * moneyValue(item.purchaseUnitCost);
    packaging += quantity * moneyValue(item.packagingUnitCost);
  });
  return { productPurchase, packaging };
}

export function buildCostRows(form: FormInstance, currency: string) {
  const totals = automaticTotals(form);
  const current = ((form.getFieldValue("costs") ?? []) as Record<string, unknown>[]).filter(Boolean);
  return costTypeOptions.map((option) => {
    const existing = current.find((item) => item.costType === option.value);
    const automaticAmount = option.value === "product_purchase" ? totals.productPurchase : option.value === "packaging_material" ? totals.packaging : undefined;
    return {
      costType: option.value,
      amount: automaticAmount ?? moneyValue(existing?.amount),
      currency: String(existing?.currency || currency || "USD"),
      exchangeRate: moneyValue(existing?.exchangeRate) || 1,
      remark: existing?.remark ?? null,
    };
  });
}

export default function OrderCostEditor({ form, currency }: Props) {
  const rows = buildCostRows(form, currency);
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      {rows.map((row, index) => {
        const option = costTypeOptions[index];
        return (
          <div key={option.value} className="rounded-lg border border-[#edf0f5] bg-[#fafcff] p-3">
            <div className="mb-2 text-sm font-medium text-[#172033]">{option.label}</div>
            <Form.Item name={["costs", index, "costType"]} initialValue={option.value} hidden><Input /></Form.Item>
            <Form.Item name={["costs", index, "currency"]} initialValue={row.currency} hidden><Input /></Form.Item>
            <Form.Item name={["costs", index, "exchangeRate"]} initialValue={row.exchangeRate} hidden><InputNumber /></Form.Item>
            <Form.Item name={["costs", index, "amount"]} initialValue={row.amount} className="!mb-2">
              <InputNumber min={0} precision={2} disabled={option.readonly} className="!w-full" addonBefore={currency} />
            </Form.Item>
            <Form.Item name={["costs", index, "remark"]} initialValue={row.remark} className="!mb-0"><Input size="small" placeholder="备注" disabled={option.readonly} /></Form.Item>
          </div>
        );
      })}
    </div>
  );
}
