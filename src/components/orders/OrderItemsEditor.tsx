"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Form, Input, InputNumber, Select } from "antd";
import type { FormInstance } from "antd";
import { useEffect, useRef } from "react";
import { moneyValue, type ProductOption } from "./orderOptions";

type Props = {
  form: FormInstance;
  products: ProductOption[];
  currencies: string[];
  baseCurrency?: string;
  orderCurrency?: string;
  orderExchangeRate?: number;
  canEditCosts?: boolean;
  onItemsChange?: () => void;
};

type ItemRow = Record<string, unknown>;

function defaultItemRow() {
  return { productName: "", productNameCn: "", productNameEn: "", quantity: 1, saleUnitPrice: 0, purchaseUnitCost: 0, purchaseCurrency: "CNY", purchaseExchangeRate: 1, packagingUnitCost: 0, packagingCurrency: "CNY", packagingExchangeRate: 1 };
}

function normalizeRows(value: unknown): ItemRow[] {
  return Array.isArray(value) ? value.map((item) => (item && typeof item === "object" ? { ...(item as ItemRow) } : {})) : [];
}

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function positiveId(value: unknown) {
  const numericValue = optionalNumber(value);
  return numericValue && numericValue > 0 ? numericValue : undefined;
}

function rowValue(row: ItemRow | undefined, key: string) {
  return moneyValue(row?.[key]);
}

function rowSubtotal(row: ItemRow | undefined, unitKey: string) {
  return (rowValue(row, "quantity") * rowValue(row, unitKey)).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rowBaseSubtotal(row: ItemRow | undefined, unitKey: string, exchangeRateKey: string) {
  const subtotal = rowValue(row, "quantity") * rowValue(row, unitKey);
  const exchangeRate = rowValue(row, exchangeRateKey) || 1;
  return (subtotal * exchangeRate).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function defaultRateForCurrency(rowCurrency: string | undefined, baseCurrency: string, orderCurrency: string, orderExchangeRate: number, fallbackRate: unknown) {
  const currency = rowCurrency || baseCurrency;
  if (currency === baseCurrency) return 1;
  if (currency === orderCurrency && orderExchangeRate > 1) return orderExchangeRate;
  return moneyValue(fallbackRate) || 1;
}

function hasCjkText(value: string) {
  return /[\u3400-\u9fff]/u.test(value);
}

function HiddenItemsField() {
  return null;
}

function TextCellInput({ value, placeholder, status, onCommit }: { value: unknown; placeholder: string; status?: "error"; onCommit: (value: string) => void }) {
  const externalValue = textValue(value);
  const composingRef = useRef(false);

  return (
    <Input
      placeholder={placeholder}
      status={status}
      defaultValue={externalValue}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        onCommit(event.currentTarget.value);
      }}
      onChange={(event) => {
        if (!composingRef.current) onCommit(event.target.value);
      }}
      onBlur={(event) => onCommit(event.currentTarget.value)}
    />
  );
}

export default function OrderItemsEditor({ form, products, currencies, baseCurrency = "CNY", orderCurrency = "USD", orderExchangeRate = 1, canEditCosts = true, onItemsChange }: Props) {
  const watchedItems = Form.useWatch("items", form);
  const rows = normalizeRows(watchedItems ?? form.getFieldValue("items"));
  const currencyOptions = Array.from(new Set([baseCurrency, ...currencies, "CNY", "USD", "EUR", "JPY", "GBP"].filter(Boolean))).map((currency) => ({ label: currency, value: currency }));
  const productOptions = [
    ...products.map((item) => ({ label: `${item.sku} / ${item.name}`, value: item.id })),
    ...rows
      .map((row) => {
        const productId = positiveId(row.productId);
        if (!productId || products.some((item) => item.id === productId)) return null;
        return { label: `${textValue(row.sku) || productId} / ${textValue(row.productNameCn) || textValue(row.productNameEn) || textValue(row.productName) || "已选产品"}`, value: productId };
      })
      .filter((item): item is { label: string; value: number } => Boolean(item)),
  ];
  const gridClass = canEditCosts
    ? "grid-cols-[190px_150px_220px_260px_180px_100px_120px_130px_120px_110px_110px_130px_130px_120px_110px_110px_130px_130px_72px]"
    : "grid-cols-[190px_150px_220px_260px_180px_100px_120px_130px_72px]";
  const minWidthClass = canEditCosts ? "min-w-[2480px]" : "min-w-[1420px]";
  const headerTitles = canEditCosts
    ? ["选择产品", "SKU", "中文名称", "英文名称", "规格", "数量", "销售单价", "销售小计", "采购单价", "采购币种", "采购汇率", "采购小计", "采购本位币", "包装单价", "包装币种", "包装汇率", "包装小计", "包装本位币", "操作"]
    : ["选择产品", "SKU", "中文名称", "英文名称", "规格", "数量", "销售单价", "销售小计", "操作"];

  useEffect(() => {
    if (normalizeRows(form.getFieldValue("items")).length === 0) {
      form.setFieldValue("items", [defaultItemRow()]);
      onItemsChange?.();
    }
  }, [form, onItemsChange]);

  function commitRows(nextRows: ItemRow[]) {
    form.setFieldValue("items", nextRows.length ? nextRows : [defaultItemRow()]);
    onItemsChange?.();
  }

  function updateRow(rowIndex: number, patch: ItemRow) {
    const currentRows = normalizeRows(form.getFieldValue("items"));
    const nextRows = currentRows.length ? [...currentRows] : [defaultItemRow()];
    nextRows[rowIndex] = { ...defaultItemRow(), ...(nextRows[rowIndex] ?? {}), ...patch };
    commitRows(nextRows);
  }

  function removeRow(rowIndex: number) {
    const nextRows = normalizeRows(form.getFieldValue("items")).filter((_, index) => index !== rowIndex);
    commitRows(nextRows);
  }

  function addRow() {
    commitRows([...normalizeRows(form.getFieldValue("items")), defaultItemRow()]);
  }

  function applyProduct(rowIndex: number, productId?: number | null) {
    if (!productId) {
      updateRow(rowIndex, { productId: null });
      return;
    }
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const currentRows = normalizeRows(form.getFieldValue("items"));
    const currentRow = currentRows[rowIndex] ?? {};
    const isChineseName = hasCjkText(product.name);
    const costPatch = canEditCosts
      ? {
          purchaseUnitCost: moneyValue(product.defaultPurchasePrice),
          purchaseCurrency: product.currency || "CNY",
          purchaseExchangeRate: defaultRateForCurrency(product.currency, baseCurrency, orderCurrency, orderExchangeRate, currentRow.purchaseExchangeRate),
          packagingUnitCost: moneyValue(product.defaultPackagingCost),
          packagingCurrency: "CNY",
          packagingExchangeRate: 1,
        }
      : {};
    updateRow(rowIndex, {
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      productNameCn: isChineseName ? product.name : textValue(currentRow.productNameCn),
      productNameEn: isChineseName ? textValue(currentRow.productNameEn) : product.name,
      specification: product.specification,
      ...costPatch,
    });
  }

  return (
    <div className="space-y-3">
      <Form.Item name="items" noStyle>
        <HiddenItemsField />
      </Form.Item>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <div className={minWidthClass}>
          <div className={`grid ${gridClass} items-center gap-0 border-b border-[var(--border)] bg-[var(--soft-bg)] text-sm font-medium text-[var(--muted)]`}>
            {headerTitles.map((title) => (
              <div key={title} className="px-3 py-3">{title}</div>
            ))}
          </div>
          {rows.map((row, rowIndex) => (
            <div key={`${row.id ?? "new"}-${rowIndex}`} className={`grid ${gridClass} items-start border-b border-[var(--border)] last:border-b-0`}>
              <div className="px-2 py-2">
                <Select allowClear showSearch optionFilterProp="label" placeholder="选择产品" className="w-full" value={positiveId(row.productId)} options={productOptions} onChange={(value) => applyProduct(rowIndex, value)} />
              </div>
              <div className="px-2 py-2"><TextCellInput key={`sku-${rowIndex}-${textValue(row.productId)}`} placeholder="SKU" value={row.sku} onCommit={(value) => updateRow(rowIndex, { sku: value })} /></div>
              <div className="px-2 py-2">
                <TextCellInput
                  key={`name-cn-${rowIndex}-${textValue(row.productId)}`}
                  status={textValue(row.productNameCn) || textValue(row.productNameEn) || textValue(row.productName) ? undefined : "error"}
                  placeholder="中文名称"
                  value={row.productNameCn}
                  onCommit={(value) => updateRow(rowIndex, { productNameCn: value, productName: value || textValue(row.productNameEn) || textValue(row.productName) })}
                />
              </div>
              <div className="px-2 py-2">
                <TextCellInput
                  key={`name-en-${rowIndex}-${textValue(row.productId)}`}
                  status={textValue(row.productNameCn) || textValue(row.productNameEn) || textValue(row.productName) ? undefined : "error"}
                  placeholder="English name"
                  value={row.productNameEn}
                  onCommit={(value) => updateRow(rowIndex, { productNameEn: value, productName: textValue(row.productNameCn) || value || textValue(row.productName) })}
                />
              </div>
              <div className="px-2 py-2"><TextCellInput key={`spec-${rowIndex}-${textValue(row.productId)}`} placeholder="规格" value={row.specification} onCommit={(value) => updateRow(rowIndex, { specification: value })} /></div>
              <div className="px-2 py-2"><InputNumber min={1} precision={0} className="!w-full text-right" value={optionalNumber(row.quantity) ?? 1} onChange={(value) => updateRow(rowIndex, { quantity: value ?? 1 })} /></div>
              <div className="px-2 py-2"><InputNumber min={0} precision={2} className="!w-full text-right" value={optionalNumber(row.saleUnitPrice) ?? 0} onChange={(value) => updateRow(rowIndex, { saleUnitPrice: value ?? 0 })} /></div>
              <div className="px-3 py-3 text-right font-medium text-[var(--foreground)]">{rowSubtotal(row, "saleUnitPrice")}</div>
              {canEditCosts ? (
                <>
                  <div className="px-2 py-2"><InputNumber min={0} precision={2} className="!w-full text-right" value={optionalNumber(row.purchaseUnitCost) ?? 0} onChange={(value) => updateRow(rowIndex, { purchaseUnitCost: value ?? 0 })} /></div>
                  <div className="px-2 py-2">
                    <Select
                      className="w-full"
                      value={textValue(row.purchaseCurrency) || "CNY"}
                      options={currencyOptions}
                      onChange={(nextCurrency) => updateRow(rowIndex, { purchaseCurrency: nextCurrency, purchaseExchangeRate: defaultRateForCurrency(nextCurrency, baseCurrency, orderCurrency, orderExchangeRate, row.purchaseExchangeRate) })}
                    />
                  </div>
                  <div className="px-2 py-2"><InputNumber min={0.000001} precision={6} className="!w-full text-right" value={optionalNumber(row.purchaseExchangeRate) ?? 1} onChange={(value) => updateRow(rowIndex, { purchaseExchangeRate: value ?? 1 })} /></div>
                  <div className="px-3 py-3 text-right text-[var(--muted)]">{rowSubtotal(row, "purchaseUnitCost")}</div>
                  <div className="px-3 py-3 text-right text-[var(--muted)]">{baseCurrency} {rowBaseSubtotal(row, "purchaseUnitCost", "purchaseExchangeRate")}</div>
                  <div className="px-2 py-2"><InputNumber min={0} precision={2} className="!w-full text-right" value={optionalNumber(row.packagingUnitCost) ?? 0} onChange={(value) => updateRow(rowIndex, { packagingUnitCost: value ?? 0 })} /></div>
                  <div className="px-2 py-2">
                    <Select
                      className="w-full"
                      value={textValue(row.packagingCurrency) || "CNY"}
                      options={currencyOptions}
                      onChange={(nextCurrency) => updateRow(rowIndex, { packagingCurrency: nextCurrency, packagingExchangeRate: defaultRateForCurrency(nextCurrency, baseCurrency, orderCurrency, orderExchangeRate, row.packagingExchangeRate) })}
                    />
                  </div>
                  <div className="px-2 py-2"><InputNumber min={0.000001} precision={6} className="!w-full text-right" value={optionalNumber(row.packagingExchangeRate) ?? 1} onChange={(value) => updateRow(rowIndex, { packagingExchangeRate: value ?? 1 })} /></div>
                  <div className="px-3 py-3 text-right text-[var(--muted)]">{rowSubtotal(row, "packagingUnitCost")}</div>
                  <div className="px-3 py-3 text-right text-[var(--muted)]">{baseCurrency} {rowBaseSubtotal(row, "packagingUnitCost", "packagingExchangeRate")}</div>
                </>
              ) : null}
              <div className="px-2 py-2 text-center">
                <Button danger type="text" icon={<DeleteOutlined />} disabled={rows.length <= 1} onClick={() => removeRow(rowIndex)} />
              </div>
            </div>
          ))}
          {rows.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-[var(--muted)]">暂无商品明细，请添加一行。</div>
          ) : null}
        </div>
      </div>
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addRow}>添加商品明细</Button>
    </div>
  );
}
