import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { businessBlockLabel, inferBusinessBlock } from "@/lib/business-blocks";
import {
  PERIOD_TYPE_WEEK,
  WEEK_NUMBERS,
  getMonthlyRows,
  normalizeMoney,
  quarterFromMonth,
  toDecimal,
  toNumber,
  type ChannelDataFilters,
} from "@/lib/channel-data";
import { prisma } from "@/lib/prisma";

const moneyFormat = "#,##0.00";
const roiFormat = "0.00";
const percentFormat = "0.0%";
const maxImportFileSize = 10 * 1024 * 1024;

const exportHeaders = [
  "板块",
  "二级",
  "渠道",
  "负责人",
  "W1销售",
  "W1广告",
  "W2销售",
  "W2广告",
  "W3销售",
  "W3广告",
  "W4销售",
  "W4广告",
  "W5销售",
  "W5广告",
  "月销售额",
  "月广告",
  "月ROI",
  "月广告占销",
  "月销售占比",
  "季销售额",
  "季广告",
  "季ROI",
  "季广告占销",
  "季销售占比",
  "评级",
  "建议动作",
  "决策deadline",
  "备注",
] as const;

export const importHeaders = [
  "所属品牌",
  "平台",
  "店铺/站点",
  "板块",
  "二级",
  "渠道",
  "负责人",
  "年份",
  "月份",
  "W1销售",
  "W1广告",
  "W2销售",
  "W2广告",
  "W3销售",
  "W3广告",
  "W4销售",
  "W4广告",
  "W5销售",
  "W5广告",
  "月销售额",
  "月广告",
  "月ROI",
  "月广告占销",
  "月销售占比",
  "季销售额",
  "季广告",
  "季ROI",
  "季广告占销",
  "季销售占比",
  "评级",
  "建议动作",
  "决策deadline",
  "备注",
] as const;

type MonthlyRow = Awaited<ReturnType<typeof getMonthlyRows>>[number];

export type ChannelImportRow = {
  rowNumber: number;
  businessBlock: string;
  businessLine: string;
  brandName: string;
  platformName: string;
  storeName: string;
  channelName: string;
  decisionOwner: string;
  year: number;
  month: number;
  weeks: Array<{ weekNumber: number; salesAmountOriginal: number; adSpendOriginal: number }>;
  manualRating: string;
  manualActionSuggestion: string;
  decisionDeadline: string;
  remark: string;
  rawSummary: string;
};

export type ChannelImportErrorRow = {
  rowNumber: number;
  errors: string[];
  rawSummary: string;
};

export type ChannelImportPreview = {
  fileName: string;
  totalRows: number;
  validRows: ChannelImportRow[];
  errorRows: ChannelImportErrorRow[];
};

export type ChannelImportConfirmResult = {
  totalRows: number;
  successRows: number;
  failedRows: number;
  errors: ChannelImportErrorRow[];
  batchId: number;
};

function getWeek(row: MonthlyRow, weekNumber: number) {
  return row.weeks.find((week) => week.weekNumber === weekNumber) ?? {
    weekNumber,
    salesAmountOriginal: 0,
    adSpendOriginal: 0,
  };
}

function rowSales(row: MonthlyRow) {
  return WEEK_NUMBERS.reduce((total, weekNumber) => total + getWeek(row, weekNumber).salesAmountOriginal, 0);
}

function rowAdSpend(row: MonthlyRow) {
  return WEEK_NUMBERS.reduce((total, weekNumber) => total + getWeek(row, weekNumber).adSpendOriginal, 0);
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function applyHeaderStyle(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1677FF" } };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FFD9E2F3" } },
      left: { style: "thin", color: { argb: "FFD9E2F3" } },
      bottom: { style: "thin", color: { argb: "FFD9E2F3" } },
      right: { style: "thin", color: { argb: "FFD9E2F3" } },
    };
  });
}

function applyNumericFormats(sheet: ExcelJS.Worksheet, headerRowNumber: number, amountColumns: number[], percentColumns: number[], roiColumns: number[]) {
  amountColumns.forEach((columnNumber) => {
    sheet.getColumn(columnNumber).numFmt = moneyFormat;
  });
  percentColumns.forEach((columnNumber) => {
    sheet.getColumn(columnNumber).numFmt = percentFormat;
  });
  roiColumns.forEach((columnNumber) => {
    sheet.getColumn(columnNumber).numFmt = roiFormat;
  });

  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    amountColumns.forEach((columnNumber) => {
      row.getCell(columnNumber).alignment = { horizontal: "right" };
    });
    percentColumns.forEach((columnNumber) => {
      row.getCell(columnNumber).alignment = { horizontal: "right" };
    });
    roiColumns.forEach((columnNumber) => {
      row.getCell(columnNumber).alignment = { horizontal: "right" };
    });
  }
}

function styleRoiCell(cell: ExcelJS.Cell, roiValue: number | null) {
  if (roiValue === null) return;
  if (roiValue >= 5) {
    cell.font = { color: { argb: "FF15803D" }, bold: true };
  } else if (roiValue > 0 && roiValue < 3) {
    cell.font = { color: { argb: "FFEA580C" }, bold: true };
  }
}

function monthLabel(year: number, month: number) {
  return `${year}年${month}月`;
}

function fileMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function quarterSales(row: MonthlyRow) {
  return toNumber(row.quarter?.salesAmount);
}

function quarterAdSpend(row: MonthlyRow) {
  return toNumber(row.quarter?.adSpend);
}

function displayRating(row: MonthlyRow) {
  if (row.ratingSource === "ai" && row.aiRating) return row.aiRating;
  return row.manualRating || row.aiRating || "";
}

function displayAction(row: MonthlyRow) {
  return row.aiActionSuggestion || row.manualActionSuggestion || "";
}

function formatExcelDate(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date;
}

async function getExchangeRateSummary(filters: ChannelDataFilters, channelIds: number[]) {
  if (channelIds.length === 0) return "—";
  const metrics = await prisma.channelMetricPeriod.findMany({
    where: {
      year: filters.year,
      month: filters.month,
      periodType: PERIOD_TYPE_WEEK,
      channelId: { in: channelIds },
    },
    select: { currency: true, exchangeRate: true },
  });
  const rateMap = new Map<string, number>();
  metrics.forEach((metric) => {
    const rate = toNumber(metric.exchangeRate, 0);
    if (rate > 0) rateMap.set(metric.currency, rate);
  });
  if (rateMap.size === 0) return "—";
  return Array.from(rateMap.entries())
    .map(([currency, rate]) => `${currency}: ${rate}`)
    .join("；");
}

export async function createChannelDataExportWorkbook(filters: ChannelDataFilters) {
  const rows = await getMonthlyRows(filters);
  const totalSales = rows.reduce((total, row) => total + rowSales(row), 0);
  const totalAdSpend = rows.reduce((total, row) => total + rowAdSpend(row), 0);
  const exchangeRateSummary = await getExchangeRateSummary(filters, rows.map((row) => row.channelId));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "跨境经营数据中心";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("渠道周报", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  sheet.mergeCells("A1:AC1");
  sheet.getCell("A1").value = `渠道效率追踪表 - ${monthLabel(filters.year, filters.month)}`;
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF172033" } };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.getCell("A2").value = `月份：${monthLabel(filters.year, filters.month)}`;
  sheet.getCell("D2").value = "单位：元";
  sheet.getCell("G2").value = `汇率：${exchangeRateSummary}`;
  sheet.getCell("A3").value = "说明：销售额和广告费按渠道录入，月度和季度指标由系统自动汇总";
  sheet.mergeCells("A3:AC3");
  sheet.getCell("A3").font = { color: { argb: "FF667085" } };

  const headerRow = sheet.addRow(exportHeaders);
  const headerRowNumber = headerRow.number;
  applyHeaderStyle(headerRow);

  rows.forEach((row) => {
    const sales = rowSales(row);
    const adSpend = rowAdSpend(row);
    const roi = ratio(sales, adSpend);
    const adRatio = sales > 0 ? adSpend / sales : 0;
    const salesShare = totalSales > 0 ? sales / totalSales : 0;
    const qSales = quarterSales(row);
    const qAdSpend = quarterAdSpend(row);
    const qRoi = ratio(qSales, qAdSpend);
    const qAdRatio = qSales > 0 ? qAdSpend / qSales : 0;
    const qSalesShare = rows.reduce((total, item) => total + quarterSales(item), 0) > 0 ? qSales / rows.reduce((total, item) => total + quarterSales(item), 0) : 0;
    const dataRow = sheet.addRow([
      businessBlockLabel(row.businessBlock),
      row.businessLine,
      row.channelName,
      row.decisionOwner ?? "",
      getWeek(row, 1).salesAmountOriginal,
      getWeek(row, 1).adSpendOriginal,
      getWeek(row, 2).salesAmountOriginal,
      getWeek(row, 2).adSpendOriginal,
      getWeek(row, 3).salesAmountOriginal,
      getWeek(row, 3).adSpendOriginal,
      getWeek(row, 4).salesAmountOriginal,
      getWeek(row, 4).adSpendOriginal,
      getWeek(row, 5).salesAmountOriginal,
      getWeek(row, 5).adSpendOriginal,
      sales,
      adSpend,
      roi,
      adRatio,
      salesShare,
      qSales,
      qAdSpend,
      qRoi,
      qAdRatio,
      qSalesShare,
      displayRating(row),
      displayAction(row),
      formatExcelDate(row.decisionDeadline),
      row.remark ?? "",
    ]);
    styleRoiCell(dataRow.getCell(17), roi);
    styleRoiCell(dataRow.getCell(22), qRoi);
  });

  const totalQuarterSales = rows.reduce((total, row) => total + quarterSales(row), 0);
  const totalQuarterAdSpend = rows.reduce((total, row) => total + quarterAdSpend(row), 0);

  const totalRow = sheet.addRow([
    "合计",
    "",
    "",
    "",
    "",
    "",
    ...WEEK_NUMBERS.flatMap((weekNumber) => [
      rows.reduce((total, row) => total + getWeek(row, weekNumber).salesAmountOriginal, 0),
      rows.reduce((total, row) => total + getWeek(row, weekNumber).adSpendOriginal, 0),
    ]),
    totalSales,
    totalAdSpend,
    ratio(totalSales, totalAdSpend),
    totalSales > 0 ? totalAdSpend / totalSales : 0,
    1,
    totalQuarterSales,
    totalQuarterAdSpend,
    ratio(totalQuarterSales, totalQuarterAdSpend),
    totalQuarterSales > 0 ? totalQuarterAdSpend / totalQuarterSales : 0,
    1,
    "",
    "",
    "",
    "",
  ]);
  totalRow.font = { bold: true };
  totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
  styleRoiCell(totalRow.getCell(17), ratio(totalSales, totalAdSpend));
  styleRoiCell(totalRow.getCell(22), ratio(totalQuarterSales, totalQuarterAdSpend));

  const widths = [12, 16, 18, 14, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 14, 14, 10, 12, 12, 14, 14, 10, 12, 12, 10, 24, 16, 24];
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  applyNumericFormats(sheet, headerRowNumber, [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20, 21], [18, 19, 23, 24], [17, 22]);
  sheet.autoFilter = { from: { row: headerRowNumber, column: 1 }, to: { row: headerRowNumber, column: exportHeaders.length } };

  return workbook;
}

export async function createChannelImportTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "跨境经营数据中心";
  workbook.created = new Date();
  workbook.modified = new Date();

  const dataSheet = workbook.addWorksheet("渠道数据导入", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const headerRow = dataSheet.addRow(importHeaders);
  applyHeaderStyle(headerRow);

  const exampleRows = (await getMonthlyRows({ year: 2026, month: 5 }))
    .filter((row) => row.store?.name)
    .slice(0, 6);

  exampleRows.forEach((row) => {
    dataSheet.addRow([
      row.brand?.name ?? "",
      row.platform?.name ?? "",
      row.store?.name ?? "",
      businessBlockLabel(row.businessBlock),
      row.businessLine,
      row.channelName,
      row.decisionOwner ?? "",
      2026,
      5,
      getWeek(row, 1).salesAmountOriginal,
      getWeek(row, 1).adSpendOriginal,
      getWeek(row, 2).salesAmountOriginal,
      getWeek(row, 2).adSpendOriginal,
      getWeek(row, 3).salesAmountOriginal,
      getWeek(row, 3).adSpendOriginal,
      getWeek(row, 4).salesAmountOriginal,
      getWeek(row, 4).adSpendOriginal,
      getWeek(row, 5).salesAmountOriginal,
      getWeek(row, 5).adSpendOriginal,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      displayRating(row),
      displayAction(row),
      formatExcelDate(row.decisionDeadline),
      "示例数据，可删除后填写",
    ]);
  });

  const widths = [14, 14, 22, 12, 16, 18, 14, 10, 10, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 14, 14, 10, 12, 12, 14, 14, 10, 12, 12, 10, 24, 16, 26];
  widths.forEach((width, index) => {
    dataSheet.getColumn(index + 1).width = width;
  });
  [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 25, 26].forEach((columnNumber) => {
    dataSheet.getColumn(columnNumber).numFmt = moneyFormat;
  });
  for (let rowNumber = 2; rowNumber <= 200; rowNumber += 1) {
    dataSheet.getCell(`H${rowNumber}`).dataValidation = {
      type: "whole",
      operator: "between",
      formulae: [2000, 2100],
      showErrorMessage: true,
      errorTitle: "年份格式错误",
      error: "请填写四位年份，例如 2026",
    };
    dataSheet.getCell(`I${rowNumber}`).dataValidation = {
      type: "whole",
      operator: "between",
      formulae: [1, 12],
      showErrorMessage: true,
      errorTitle: "月份格式错误",
      error: "请填写 1-12 的月份",
    };
  }

  const instructionSheet = workbook.addWorksheet("填写说明");
  instructionSheet.columns = [{ width: 90 }];
  [
    "1. 所属品牌、平台、店铺/站点、渠道需要和系统基础资料一致。",
    "2. 年份填写四位数字，例如 2026。",
    "3. 月份填写 1-12。",
    "4. W1-W5 销售和广告可以为空，空值按 0 处理。",
    "5. 月度/季度计算字段会被系统忽略并重新计算。",
    "6. 负责人、评级、建议动作、决策 deadline、备注会写入渠道周期数据。",
    "7. 不要修改表头名称。",
    "8. 导入会按照 年份 + 月份 + 渠道 匹配并更新数据。",
    "9. 如果渠道不存在，该行会导入失败并返回错误原因。",
  ].forEach((text) => instructionSheet.addRow([text]));
  instructionSheet.getRow(1).font = { bold: true };

  return workbook;
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value) return normalizeText(value.result);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((item: { text?: string }) => item.text ?? "").join("").trim();
    }
  }
  return String(value).trim();
}

function parseInteger(value: unknown) {
  const text = normalizeText(value).replace(/,/g, "");
  if (!text) return null;
  const numericValue = Number(text);
  return Number.isInteger(numericValue) ? numericValue : NaN;
}

function parseAmount(value: unknown) {
  const text = normalizeText(value).replace(/,/g, "").replace(/[￥¥$€£\s]/g, "");
  if (!text) return 0;
  const numericValue = Number(text);
  return Number.isFinite(numericValue) ? numericValue : NaN;
}

function buildRawSummary(row: Partial<ChannelImportRow>) {
  return [row.brandName, row.platformName, row.storeName || "-", row.channelName, row.year, row.month]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .join(" / ");
}

function validateImportRowBasics(row: ChannelImportRow) {
  const errors: string[] = [];
  if (!row.brandName) errors.push("所属品牌为空");
  if (!row.platformName) errors.push("平台为空");
  if (!row.storeName) errors.push("店铺/站点为空");
  if (!row.channelName) errors.push("渠道名称为空");
  if (!Number.isInteger(row.year) || row.year < 2000 || row.year > 2100) errors.push("年份格式不正确");
  if (!Number.isInteger(row.month) || row.month < 1 || row.month > 12) errors.push("月份必须在 1-12 之间");

  WEEK_NUMBERS.forEach((weekNumber) => {
    const week = row.weeks.find((item) => item.weekNumber === weekNumber);
    const salesAmount = week?.salesAmountOriginal ?? 0;
    const adSpend = week?.adSpendOriginal ?? 0;
    if (!Number.isFinite(Number(salesAmount))) errors.push(`W${weekNumber}销售不是数字`);
    if (!Number.isFinite(Number(adSpend))) errors.push(`W${weekNumber}广告不是数字`);
    if (Number(salesAmount) < 0) errors.push(`W${weekNumber}销售不能为负数`);
    if (Number(adSpend) < 0) errors.push(`W${weekNumber}广告不能为负数`);
  });

  return errors;
}

function getCellValue(row: ExcelJS.Row, headerIndex: number) {
  return row.getCell(headerIndex + 1).value;
}

export function validateImportFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("仅支持 .xlsx 文件");
  }
  if (file.size > maxImportFileSize) {
    throw new Error("文件不能超过 10MB");
  }
}

export async function parseChannelImportWorkbook(fileName: string, buffer: ArrayBuffer): Promise<ChannelImportPreview> {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("文件格式不正确，请上传有效的 .xlsx 文件");
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new Error("Excel 解析失败，请检查文件是否为有效的 xlsx 文件");
  }

  const sheet = workbook.getWorksheet("渠道数据导入") ?? workbook.worksheets[0];
  if (!sheet) throw new Error("Excel 文件中没有可读取的工作表");

  const headerRow = sheet.getRow(1);
  const headers = importHeaders.map((_, index) => normalizeText(headerRow.getCell(index + 1).value));
  const missingHeaders = importHeaders.filter((header, index) => headers[index] !== header);
  if (missingHeaders.length > 0) {
    throw new Error(`导入模板表头不正确，请不要修改表头。异常字段：${missingHeaders.join("、")}`);
  }

  const parsedRows: ChannelImportRow[] = [];
  const rowErrors: ChannelImportErrorRow[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const excelRow = sheet.getRow(rowNumber);
    const values = importHeaders.map((_, index) => getCellValue(excelRow, index));
    const hasValue = values.some((value) => normalizeText(value));
    if (!hasValue) continue;

    const draft: ChannelImportRow = {
      rowNumber,
      brandName: normalizeText(values[0]),
      platformName: normalizeText(values[1]),
      storeName: normalizeText(values[2]),
      businessBlock: normalizeText(values[3]),
      businessLine: normalizeText(values[4]),
      channelName: normalizeText(values[5]),
      decisionOwner: normalizeText(values[6]),
      year: 0,
      month: 0,
      weeks: [],
      manualRating: normalizeText(values[29]),
      manualActionSuggestion: normalizeText(values[30]),
      decisionDeadline: normalizeText(values[31]),
      remark: normalizeText(values[32]),
      rawSummary: "",
    };
    const errors: string[] = [];

    if (!draft.brandName) errors.push("所属品牌为空");
    if (!draft.platformName) errors.push("平台为空");
    if (!draft.storeName) errors.push("店铺/站点为空");
    if (!draft.channelName) errors.push("渠道名称为空");

    const year = parseInteger(values[7]);
    const month = parseInteger(values[8]);
    if (year === null) errors.push("年份为空");
    else if (!Number.isInteger(year) || year < 2000 || year > 2100) errors.push("年份格式不正确");
    if (month === null) errors.push("月份为空");
    else if (!Number.isInteger(month) || month < 1 || month > 12) errors.push("月份必须在 1-12 之间");

    draft.year = Number.isFinite(year) ? Number(year) : 0;
    draft.month = Number.isFinite(month) ? Number(month) : 0;

    draft.weeks = WEEK_NUMBERS.map((weekNumber, index) => {
      const sales = parseAmount(values[9 + index * 2]);
      const adSpend = parseAmount(values[10 + index * 2]);
      if (!Number.isFinite(sales)) errors.push(`W${weekNumber}销售不是数字`);
      if (!Number.isFinite(adSpend)) errors.push(`W${weekNumber}广告不是数字`);
      return {
        weekNumber,
        salesAmountOriginal: Number.isFinite(sales) ? sales : 0,
        adSpendOriginal: Number.isFinite(adSpend) ? adSpend : 0,
      };
    });
    draft.rawSummary = buildRawSummary(draft);

    if (errors.length > 0) {
      rowErrors.push({ rowNumber, errors, rawSummary: draft.rawSummary });
    } else {
      parsedRows.push(draft);
    }
  }

  const { validRows, errorRows } = await validateImportRows(parsedRows);
  return {
    fileName,
    totalRows: parsedRows.length + rowErrors.length,
    validRows,
    errorRows: [...rowErrors, ...errorRows].sort((a, b) => a.rowNumber - b.rowNumber),
  };
}

async function findBrand(brandName: string) {
  return prisma.brand.findFirst({
    where: { OR: [{ name: brandName }, { code: brandName.toUpperCase() }] },
    select: { id: true, name: true, defaultCurrency: true },
  });
}

async function findPlatform(platformName: string) {
  return prisma.platform.findFirst({
    where: { OR: [{ name: platformName }, { code: platformName.toUpperCase() }] },
    select: { id: true, name: true },
  });
}

async function findStore(storeName: string, brandId: number, platformId: number) {
  if (!storeName) return null;
  return prisma.store.findFirst({
    where: {
      brandId,
      platformId,
      OR: [{ name: storeName }, { domain: storeName }],
    },
    select: { id: true, name: true, primaryMarketCode: true, defaultCurrency: true },
  });
}

async function resolveImportRow(row: ChannelImportRow) {
  const errors: string[] = [];
  const brand = await findBrand(row.brandName);
  if (!brand) errors.push("未找到匹配品牌");
  const platform = await findPlatform(row.platformName);
  if (!platform) errors.push("未找到匹配平台");

  if (!brand || !platform) {
    return { errors, channel: null, brand: null, platform: null, store: null };
  }

  const store = await findStore(row.storeName, brand.id, platform.id);
  if (!store) errors.push("未找到匹配店铺/站点");

  const channels = await prisma.channel.findMany({
    where: {
      brandId: brand.id,
      platformId: platform.id,
      channelName: row.channelName,
      storeId: store?.id ?? -1,
    },
    select: {
      id: true,
      brandId: true,
      platformId: true,
      storeId: true,
      businessLine: true,
      channelType: true,
      channelName: true,
      platform: { select: { id: true, name: true } },
      store: { select: { id: true, primaryMarketCode: true, defaultCurrency: true, storeType: true } },
      brand: { select: { defaultCurrency: true } },
    },
  });

  if (channels.length === 0) errors.push("未找到匹配渠道");
  if (channels.length > 1) errors.push("渠道匹配不唯一，请检查基础资料");

  return { errors, channel: channels[0] ?? null, brand, platform, store };
}

export async function validateImportRows(rows: ChannelImportRow[]) {
  const validRows: ChannelImportRow[] = [];
  const errorRows: ChannelImportErrorRow[] = [];

  for (const row of rows) {
    const basicErrors = validateImportRowBasics(row);
    if (basicErrors.length > 0) {
      errorRows.push({ rowNumber: row.rowNumber, errors: basicErrors, rawSummary: row.rawSummary || buildRawSummary(row) });
      continue;
    }

    const { errors } = await resolveImportRow(row);
    if (errors.length > 0) {
      errorRows.push({ rowNumber: row.rowNumber, errors, rawSummary: row.rawSummary || buildRawSummary(row) });
    } else {
      validRows.push(row);
    }
  }

  return { validRows, errorRows };
}

export async function importChannelRows({
  fileName,
  rows,
  createdBy,
  previewFailedRows = 0,
  previewTotalRows,
}: {
  fileName: string;
  rows: ChannelImportRow[];
  createdBy?: number;
  previewFailedRows?: number;
  previewTotalRows?: number;
}): Promise<ChannelImportConfirmResult> {
  const { validRows, errorRows } = await validateImportRows(rows);
  const importMonths = new Set(validRows.map((row) => `${row.year}-${String(row.month).padStart(2, "0")}`));
  let successRows = 0;
  const failedErrors: ChannelImportErrorRow[] = [...errorRows];

  for (const row of validRows) {
    const resolved = await resolveImportRow(row);
    const channel = resolved.channel;
    if (!channel || resolved.errors.length > 0 || !channel.brandId || !channel.platformId) {
      failedErrors.push({ rowNumber: row.rowNumber, errors: resolved.errors.length ? resolved.errors : ["渠道数据不完整"], rawSummary: row.rawSummary });
      continue;
    }

    try {
      const quarter = quarterFromMonth(row.month);
      const brandId = channel.brandId;
      const platformId = channel.platformId;
      const currency = channel.store?.defaultCurrency ?? channel.brand?.defaultCurrency ?? "CNY";
      const countryCode = channel.store?.primaryMarketCode ?? null;
      const parsedDecisionDeadline = row.decisionDeadline ? new Date(row.decisionDeadline) : null;
      const decisionDeadline = parsedDecisionDeadline && Number.isFinite(parsedDecisionDeadline.getTime()) ? parsedDecisionDeadline : null;
      const businessBlock = inferBusinessBlock({
        businessBlock: row.businessBlock,
        businessLine: channel.businessLine,
        platformName: channel.platform?.name,
        storeType: channel.store?.storeType,
        channelType: channel.channelType,
      });
      const manualRating = row.manualRating?.trim() || null;
      const manualActionSuggestion = row.manualActionSuggestion?.trim() || null;
      const decisionOwner = row.decisionOwner?.trim() || null;
      await prisma.$transaction(
        WEEK_NUMBERS.map((weekNumber) => {
          const week = row.weeks.find((item) => item.weekNumber === weekNumber);
          const salesAmount = normalizeMoney(week?.salesAmountOriginal);
          const adSpend = normalizeMoney(week?.adSpendOriginal);
          return prisma.channelMetricPeriod.upsert({
            where: {
              year_month_periodType_weekNumber_channelId: {
                year: row.year,
                month: row.month,
                periodType: PERIOD_TYPE_WEEK,
                weekNumber,
                channelId: channel.id,
              },
            },
            update: {
              quarter,
              brandId,
              platformId,
              storeId: channel.storeId,
              countryCode,
              currency,
              salesAmountOriginal: toDecimal(salesAmount),
              adSpendOriginal: toDecimal(adSpend),
              exchangeRate: new Prisma.Decimal("1"),
              salesAmountBase: toDecimal(salesAmount),
              adSpendBase: toDecimal(adSpend),
              businessBlock,
              manualRating,
              ratingSource: manualRating ? "manual" : "none",
              aiAnalysisStatus: "pending",
              manualActionSuggestion,
              decisionOwner,
              decisionDeadline,
              remark: row.remark || null,
              createdBy,
            },
            create: {
              year: row.year,
              month: row.month,
              quarter,
              weekNumber,
              periodType: PERIOD_TYPE_WEEK,
              brandId,
              platformId,
              storeId: channel.storeId,
              channelId: channel.id,
              countryCode,
              currency,
              salesAmountOriginal: toDecimal(salesAmount),
              adSpendOriginal: toDecimal(adSpend),
              exchangeRate: new Prisma.Decimal("1"),
              salesAmountBase: toDecimal(salesAmount),
              adSpendBase: toDecimal(adSpend),
              businessBlock,
              manualRating,
              ratingSource: manualRating ? "manual" : "none",
              aiAnalysisStatus: "pending",
              manualActionSuggestion,
              decisionOwner,
              decisionDeadline,
              remark: row.remark || null,
              createdBy,
            },
          });
        }),
      );
      successRows += 1;
    } catch (error) {
      failedErrors.push({
        rowNumber: row.rowNumber,
        errors: [error instanceof Error ? error.message : "导入写入失败"],
        rawSummary: row.rawSummary,
      });
    }
  }

  const totalRows = Math.max(previewTotalRows ?? rows.length, successRows + failedErrors.length + previewFailedRows);
  const failedRows = failedErrors.length + previewFailedRows;
  const status = failedRows === 0 ? "success" : successRows > 0 ? "partial" : "failed";
  const errorMessage = failedErrors.length
    ? failedErrors.map((row) => `第${row.rowNumber}行：${row.errors.join("；")}`).join("\n").slice(0, 4000)
    : null;

  const batch = await prisma.metricImportBatch.create({
    data: {
      fileName,
      sourceType: "excel",
      importMonth: importMonths.size === 1 ? Array.from(importMonths)[0] : importMonths.size > 1 ? Array.from(importMonths).join(",") : "-",
      status,
      totalRows,
      successRows,
      failedRows,
      errorMessage,
      createdBy,
    },
  });

  return { totalRows, successRows, failedRows, errors: failedErrors, batchId: batch.id };
}

export function excelFileName(year: number, month: number) {
  return `渠道数据周报_${fileMonth(year, month)}.xlsx`;
}

export function templateFileName() {
  return "渠道数据导入模板.xlsx";
}

export async function workbookToResponse(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const body = new Blob([buffer as BlobPart], { type: contentType });
  const encoded = encodeURIComponent(filename);
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="channel-data.xlsx"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "no-store",
    },
  });
}

export { maxImportFileSize };
