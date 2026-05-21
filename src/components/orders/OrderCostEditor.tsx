"use client";

import { Form, Input, InputNumber, Select } from "antd";
import type { FormInstance } from "antd";
import { costTypeOptions, moneyValue } from "./orderOptions";

const DEFAULT_CURRENCIES = ["CNY", "USD", "EUR", "JPY", "GBP"];

type Props = { form: FormInstance; currency: string; baseCurrency?: string; currencies?: string[] };

function automaticTotals(form: FormInstance) {
  const items = (form.getFieldValue("items") ?? []) as Record<string, unknown>[];
  let productPurchase = 0;
  let packaging = 0;
  items.forEach((item) => {
    const quantity = moneyValue(item.quantity);
    productPurchase += quantity * moneyValue(item.purchaseUnitCost) * (moneyValue(item.purchaseExchangeRate) || 1);
    packaging += quantity * moneyValue(item.packagingUnitCost) * (moneyValue(item.packagingExchangeRate) || 1);
  });
  return { productPurchase, packaging };
}

function costExchangeRate(existingRate: unknown, rowCurrency: string, orderCurrency: string, baseCurrency: string, defaultExchangeRate: number) {
  if (rowCurrency === baseCurrency) return 1;
  const currentRate = moneyValue(existingRate);
  if (rowCurrency === orderCurrency && defaultExchangeRate && currentRate <= 1) return defaultExchangeRate;
  return currentRate || defaultExchangeRate || 1;
}

export function buildCostRows(form: FormInstance, currency: string, baseCurrency = "CNY", defaultExchangeRate = 1) {
  const totals = automaticTotals(form);
  const current = ((form.getFieldValue("costs") ?? []) as Record<string, unknown>[]).filter(Boolean);
  return costTypeOptions.map((option) => {
    const existing = current.find((item) => item.costType === option.value);
    const automaticAmount = option.value === "product_purchase" ? totals.productPurchase : option.value === "packaging_material" ? totals.packaging : undefined;
    const rowCurrency = automaticAmount === undefined ? String(existing?.currency || currency || "USD") : baseCurrency;
    const rowExchangeRate = automaticAmount === undefined ? costExchangeRate(existing?.exchangeRate, rowCurrency, currency, baseCurrency, defaultExchangeRate) : 1;
    const amount = automaticAmount ?? moneyValue(existing?.amount);
    return {
      costType: option.value,
      amount,
      currency: rowCurrency,
      exchangeRate: rowExchangeRate,
      baseAmount: amount * rowExchangeRate,
      remark: existing?.remark ?? null,
    };
  });
}

export default function OrderCostEditor({ form, currency, baseCurrency = "CNY", currencies = DEFAULT_CURRENCIES }: Props) {
  const defaultExchangeRate = moneyValue(form.getFieldValue("exchangeRate")) || 1;
  const rows = buildCostRows(form, currency, baseCurrency, defaultExchangeRate);
  const currencyOptions = Array.from(new Set([baseCurrency, currency, ...currencies, ...DEFAULT_CURRENCIES].filter(Boolean))).map((value) => ({ label: value, value }));
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      {rows.map((row, index) => {
        const option = costTypeOptions[index];
        return (
          <div key={option.value} className="rounded-lg border border-[var(--border)] bg-[var(--soft-bg)] p-3">
            <div className="mb-2 text-sm font-medium text-[var(--foreground)]">{option.label}</div>
            <Form.Item name={["costs", index, "costType"]} initialValue={option.value} hidden><Input /></Form.Item>
            <div className="grid grid-cols-[1fr_92px] gap-2">
              <Form.Item name={["costs", index, "amount"]} initialValue={row.amount} className="!mb-2">
                <InputNumber min={0} precision={2} disabled={option.readonly} className="!w-full" />
              </Form.Item>
              <Form.Item name={["costs", index, "currency"]} initialValue={row.currency} className="!mb-2">
                <Select
                  disabled={option.readonly}
                  options={currencyOptions}
                  onChange={(nextCurrency) => form.setFieldValue(["costs", index, "exchangeRate"], nextCurrency === baseCurrency ? 1 : defaultExchangeRate)}
                />
              </Form.Item>
            </div>
            <Form.Item name={["costs", index, "exchangeRate"]} initialValue={row.exchangeRate} className="!mb-2" extra={option.readonly ? "自动汇总为本位币" : `换算到 ${baseCurrency}`}>
              <InputNumber min={0.000001} precision={6} disabled={option.readonly} className="!w-full" addonBefore="汇率" />
            </Form.Item>
            <Form.Item name={["costs", index, "remark"]} initialValue={row.remark} className="!mb-0"><Input size="small" placeholder="备注" disabled={option.readonly} /></Form.Item>
          </div>
        );
      })}
    </div>
  );
}
