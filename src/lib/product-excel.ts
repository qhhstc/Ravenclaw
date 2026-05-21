import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { buildProductWhere, normalizeProductInput } from "@/lib/products";
import { workbookToResponse } from "@/lib/order-excel";
import type { SessionUser } from "@/lib/permissions";

export type ProductPreviewRow = {
  rowNumber: number;
  valid: boolean;
  errors: string[];
  data: Record<string, unknown>;
  summary: string;
};

const headers = ["SKU", "产品名称", "产品规格", "分类", "默认采购单价", "默认包装成本", "币种", "默认供应商", "重量", "体积", "状态", "备注"];

const headerMap: Record<string, string> = {
  SKU: "sku",
  产品名称: "name",
  产品规格: "specification",
  分类: "category",
  默认采购单价: "defaultPurchasePrice",
  默认包装成本: "defaultPackagingCost",
  币种: "currency",
  默认供应商: "defaultVendorName",
  重量: "weight",
  体积: "volume",
  状态: "status",
  备注: "remark",
};

function valueText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value !== null && "text" in value) return String((value as { text?: unknown }).text ?? "").trim();
  return String(value).trim();
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FF172033" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
  row.alignment = { horizontal: "center", vertical: "middle" };
}

function setWidths(sheet: ExcelJS.Worksheet) {
  [18, 36, 32, 14, 16, 16, 10, 24, 12, 12, 10, 32].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

export async function createProductTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Ravenclaw";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("产品导入", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow(headers);
  styleHeader(sheet.getRow(1));
  setWidths(sheet);
  [5, 6, 9, 10].forEach((index) => {
    sheet.getColumn(index).numFmt = "#,##0.00";
  });
  const products = await prisma.product.findMany({ include: { defaultVendor: true }, orderBy: { id: "asc" }, take: 5 });
  const fallbackVendors = await prisma.vendor.findMany({ where: { status: "active" }, orderBy: { id: "asc" }, take: 1 });
  const sampleVendor = fallbackVendors[0]?.name ?? "示例供应商";
  (products.length
    ? products
    : [
        {
          sku: "BB-KIMMON-OCEAN",
          name: "NEW Kimmon Ocean Fridge Magnet Series Plush Blind Box",
          specification: "9 basic styles + 1 hidden style",
          category: "盲盒",
          defaultPurchasePrice: 3.2,
          defaultPackagingCost: 0.25,
          currency: "CNY",
          defaultVendor: { name: sampleVendor },
          weight: 0.12,
          volume: 0.002,
          status: "active",
          remark: "示例行，可删除",
        },
      ]).forEach((product) => {
    sheet.addRow([
      product.sku,
      product.name,
      product.specification ?? "",
      product.category ?? "",
      Number(product.defaultPurchasePrice ?? 0),
      Number(product.defaultPackagingCost ?? 0),
      product.currency ?? "CNY",
      product.defaultVendor?.name ?? sampleVendor,
      Number(product.weight ?? 0),
      Number(product.volume ?? 0),
      product.status ?? "active",
      product.remark ?? "",
    ]);
  });
  const instruction = workbook.addWorksheet("填写说明");
  instruction.addRows([
    ["填写说明"],
    ["1. SKU 必填且唯一，导入确认时会按 SKU 执行 upsert。"],
    ["2. 产品名称必填。"],
    ["3. 默认供应商需要和系统供应商名称一致，否则该行导入失败。"],
    ["4. 默认采购单价、默认包装成本、重量、体积需填写数字，空值按 0 处理。"],
    ["5. 状态填写 active 或 inactive。"],
    ["6. 不要修改表头名称。"],
  ]);
  instruction.getRow(1).font = { bold: true, size: 14 };
  instruction.getColumn(1).width = 90;
  return workbook;
}

export async function createProductExportWorkbook(params: URLSearchParams, session: SessionUser) {
  void session;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Ravenclaw";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("产品列表", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow(headers);
  styleHeader(sheet.getRow(1));
  setWidths(sheet);
  const products = await prisma.product.findMany({ where: buildProductWhere(params), include: { defaultVendor: true }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }] });
  products.forEach((product) => {
    sheet.addRow([
      product.sku,
      product.name,
      product.specification ?? "",
      product.category ?? "",
      Number(product.defaultPurchasePrice),
      Number(product.defaultPackagingCost),
      product.currency,
      product.defaultVendor?.name ?? "",
      product.weight == null ? "" : Number(product.weight),
      product.volume == null ? "" : Number(product.volume),
      product.status,
      product.remark ?? "",
    ]);
  });
  [5, 6, 9, 10].forEach((index) => {
    sheet.getColumn(index).numFmt = "#,##0.00";
  });
  return workbook;
}

export async function previewProductWorkbook(buffer: ArrayBuffer): Promise<ProductPreviewRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("产品导入") ?? workbook.worksheets[0];
  if (!sheet) throw new Error("Excel 文件中没有可读取的工作表");
  const firstRow = sheet.getRow(1);
  const actualHeaders = firstRow.values as unknown[];
  const indexes = headers.map((title) => actualHeaders.findIndex((value) => valueText(value) === title));
  if (indexes.some((index) => index <= 0)) throw new Error("模板表头不正确，请下载最新导入模板");

  const vendorNames = new Set((await prisma.vendor.findMany({ select: { name: true } })).map((vendor) => vendor.name));
  const rows: ProductPreviewRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const data = headers.reduce<Record<string, unknown>>((result, title, index) => {
      result[headerMap[title]] = row.getCell(indexes[index]).value;
      return result;
    }, {});
    const sku = valueText(data.sku).toUpperCase();
    const name = valueText(data.name);
    const vendorName = valueText(data.defaultVendorName);
    const errors: string[] = [];
    if (!sku) errors.push("SKU 不能为空");
    if (!name) errors.push("产品名称不能为空");
    if (vendorName && !vendorNames.has(vendorName)) errors.push("供应商不存在");
    ["defaultPurchasePrice", "defaultPackagingCost", "weight", "volume"].forEach((key) => {
      const text = valueText(data[key]);
      if (text && !Number.isFinite(Number(text))) errors.push(`${headers.find((title) => headerMap[title] === key)} 必须是数字`);
    });
    if (!Object.values(data).some((value) => valueText(value))) return;
    rows.push({
      rowNumber,
      valid: errors.length === 0,
      errors,
      data: {
        sku,
        name,
        specification: valueText(data.specification),
        category: valueText(data.category),
        defaultPurchasePrice: Number(valueText(data.defaultPurchasePrice) || 0),
        defaultPackagingCost: Number(valueText(data.defaultPackagingCost) || 0),
        currency: valueText(data.currency).toUpperCase() || "CNY",
        defaultVendorName: vendorName,
        weight: Number(valueText(data.weight) || 0),
        volume: Number(valueText(data.volume) || 0),
        status: valueText(data.status) || "active",
        remark: valueText(data.remark),
      },
      summary: `${sku || "未填 SKU"} / ${name || "未填名称"}`,
    });
  });
  return rows;
}

export async function importProductRows(rows: Array<Record<string, unknown>>) {
  const vendors = await prisma.vendor.findMany({ select: { id: true, name: true } });
  const vendorMap = new Map(vendors.map((vendor) => [vendor.name, vendor.id]));
  let successRows = 0;
  const errors: ProductPreviewRow[] = [];
  for (const [index, row] of rows.entries()) {
    try {
      const vendorName = valueText(row.defaultVendorName);
      const defaultVendorId = vendorName ? vendorMap.get(vendorName) : null;
      if (vendorName && !defaultVendorId) throw new Error("供应商不存在");
      const data = normalizeProductInput({ ...row, defaultVendorId });
      await prisma.product.upsert({ where: { sku: data.sku }, create: data, update: data });
      successRows += 1;
    } catch (error) {
      errors.push({
        rowNumber: Number(row.rowNumber) || index + 2,
        valid: false,
        errors: [error instanceof Error ? error.message : "导入失败"],
        data: row,
        summary: `${valueText(row.sku) || "未填 SKU"} / ${valueText(row.name) || "未填名称"}`,
      });
    }
  }
  return { successRows, failedRows: errors.length, errors };
}

export async function productWorkbookResponse(workbook: ExcelJS.Workbook, filename: string) {
  return workbookToResponse(workbook, filename);
}
