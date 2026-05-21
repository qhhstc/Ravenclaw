"use client";

import { Form, Input, InputNumber, Select, message } from "antd";
import { useState } from "react";
import type { FormInstance } from "antd";
import { costTypeOptions, moneyValue } from "./orderOptions";

const DEFAULT_CURRENCIES = ["CNY", "USD", "EUR", "JPY", "GBP"];
const DOMESTIC_COST_TYPES = new Set(["domestic_shipping", "customs_fee", "port_charge", "trucking_fee"]);

type Props = { form: FormInstance; currency: string; baseCurrency?: string; currencies?: string[] };
type BuildCostRowsOptions = {
  refreshOrderCurrencyRates?: boolean;
};

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

function costExchangeRate(existingRate: unknown, rowCurrency: string, orderCurrency: string, baseCurrency: string, defaultExchangeRate: number, refreshOrderCurrencyRates = false) {
  if (rowCurrency === baseCurrency) return 1;
  const currentRate = moneyValue(existingRate);
  if (rowCurrency === orderCurrency && defaultExchangeRate && refreshOrderCurrencyRates) return defaultExchangeRate;
  if (rowCurrency === orderCurrency && defaultExchangeRate && currentRate <= 1) return defaultExchangeRate;
  return currentRate || defaultExchangeRate || 1;
}

function defaultCurrencyForCost(costType: string, orderCurrency: string, baseCurrency: string) {
  if (costType === "product_purchase" || costType === "packaging_material") return baseCurrency;
  if (DOMESTIC_COST_TYPES.has(costType)) return baseCurrency;
  return orderCurrency || "USD";
}

export function buildCostRows(form: FormInstance, currency: string, baseCurrency = "CNY", defaultExchangeRate = 1, options: BuildCostRowsOptions = {}) {
  const totals = automaticTotals(form);
  const current = ((form.getFieldValue("costs") ?? []) as Record<string, unknown>[]).filter(Boolean);
  return costTypeOptions.map((option) => {
    const existing = current.find((item) => item.costType === option.value);
    const automaticAmount = option.value === "product_purchase" ? totals.productPurchase : option.value === "packaging_material" ? totals.packaging : undefined;
    const defaultCurrency = defaultCurrencyForCost(option.value, currency, baseCurrency);
    const rowCurrency = automaticAmount === undefined ? String(existing?.currency || defaultCurrency) : baseCurrency;
    const rowExchangeRate = automaticAmount === undefined ? costExchangeRate(existing?.exchangeRate, rowCurrency, currency, baseCurrency, defaultExchangeRate, options.refreshOrderCurrencyRates) : 1;
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
  const [loadingCostIndex, setLoadingCostIndex] = useState<number | null>(null);
  const defaultExchangeRate = moneyValue(form.getFieldValue("exchangeRate")) || 1;
  const rows = buildCostRows(form, currency, baseCurrency, defaultExchangeRate);
  const currencyOptions = Array.from(new Set([baseCurrency, currency, ...currencies, ...DEFAULT_CURRENCIES].filter(Boolean))).map((value) => ({ label: value, value }));

  async function updateCostExchangeRate(index: number, nextCurrency: string) {
    const normalizedCurrency = nextCurrency.toUpperCase();
    if (normalizedCurrency === baseCurrency) {
      form.setFieldValue(["costs", index, "exchangeRate"], 1);
      return;
    }
    if (normalizedCurrency === currency && defaultExchangeRate > 1) {
      form.setFieldValue(["costs", index, "exchangeRate"], defaultExchangeRate);
      return;
    }
    setLoadingCostIndex(index);
    try {
      const orderDate = form.getFieldValue("orderDate");
      const date = orderDate && typeof orderDate === "object" && "format" in orderDate ? orderDate.format("YYYY-MM-DD") : undefined;
      const search = new URLSearchParams({ from: normalizedCurrency, to: baseCurrency });
      if (date) search.set("date", date);
      const response = await fetch(`/api/exchange-rates/latest?${search.toString()}`);
      const data = (await response.json()) as { rate?: number; message?: string };
      if (!response.ok || !data.rate) throw new Error(data.message || "暂未获取到参考汇率");
      form.setFieldValue(["costs", index, "exchangeRate"], data.rate);
      message.success(`已刷新 ${normalizedCurrency}/${baseCurrency} 汇率`);
    } catch (error) {
      message.warning(error instanceof Error ? error.message : "暂未获取到该成本币种汇率，请手动填写");
    } finally {
      setLoadingCostIndex(null);
    }
  }

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
                  loading={loadingCostIndex === index}
                  onChange={(nextCurrency) => void updateCostExchangeRate(index, nextCurrency)}
                />
              </Form.Item>
            </div>
            <Form.Item name={["costs", index, "exchangeRate"]} initialValue={row.exchangeRate} className="!mb-2" extra={option.readonly ? "自动汇总为本位币" : loadingCostIndex === index ? "正在刷新汇率…" : `换算到 ${baseCurrency}`}>
              <InputNumber min={0.000001} precision={6} disabled={option.readonly} className="!w-full" addonBefore="汇率" />
            </Form.Item>
            <Form.Item name={["costs", index, "remark"]} initialValue={row.remark} className="!mb-0"><Input size="small" placeholder="备注" disabled={option.readonly} /></Form.Item>
          </div>
        );
      })}
    </div>
  );
}
