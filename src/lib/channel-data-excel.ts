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
  sourceType?: "standard" | "customer_original";
  businessBlock: string;
  businessLine: string;
  brandName: string;
  platformName: string;
  storeName: string;
  channelName: string;
  decisionOwner: string;
  year: number;
  month: number;
  currency?: string;
  exchangeRate?: number;
  weeks: Array<{ weekNumber: number; salesAmountOriginal: number; adSpendOriginal: number }>;
  manualRating: string;
  manualActionSuggestion: string;
  decisionDeadline: string;
  remark: string;
  rawSummary: string;
};

export type ChannelImportWeekMapping = {
  sourceLabel: string;
  weekNumber: number;
};

export type ChannelImportErrorRow = {
  rowNumber: number;
  errors: string[];
  rawSummary: string;
};

export type ChannelImportPreview = {
  fileName: string;
  sourceType: "standard" | "customer_original";
  importYear?: number;
  importMonth?: number;
  weekMappings: ChannelImportWeekMapping[];
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

function parseCustomerSourceYearMonth(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet, fallbackYear?: number, fallbackMonth?: number) {
  const textParts: string[] = [];
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 3); rowNumber += 1) {
    for (let columnNumber = 1; columnNumber <= Math.min(sheet.columnCount, 6); columnNumber += 1) {
      const text = normalizeText(sheet.getRow(rowNumber).getCell(columnNumber).value);
      if (text) textParts.push(text);
    }
  }
  const text = [workbook.subject, workbook.title, ...textParts].filter(Boolean).join(" ");
  const yearMatch = text.match(/(20\d{2})\s*年?/);
  const monthRangeMatch = text.match(/(\d{1,2})\s*[-~至]\s*(\d{1,2})\s*[_\s-]*月/);
  const singleMonthMatch = text.match(/(\d{1,2})\s*月/);
  return {
    year: fallbackYear ?? (yearMatch ? Number(yearMatch[1]) : new Date().getFullYear()),
    month: fallbackMonth ?? (monthRangeMatch ? Number(monthRangeMatch[2]) : singleMonthMatch ? Number(singleMonthMatch[1]) : new Date().getMonth() + 1),
  };
}

function parseCustomerCurrencyAndRate(sheet: ExcelJS.Worksheet) {
  const textParts: string[] = [];
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 3); rowNumber += 1) {
    for (let columnNumber = 1; columnNumber <= Math.min(sheet.columnCount, 8); columnNumber += 1) {
      const text = normalizeText(sheet.getRow(rowNumber).getCell(columnNumber).value);
      if (text) textParts.push(text);
    }
  }
  const text = textParts.join(" ");
  const currency = /美金|美元|USD/i.test(text) ? "USD" : "CNY";
  const usdRate = text.match(/USD\s*[=：:]\s*(\d+(?:\.\d+)?)/i);
  return { currency, exchangeRate: usdRate ? Number(usdRate[1]) : 1 };
}

function parseCustomerWeekEndMonth(label: string, year: number) {
  const compact = label.replace(/\s/g, "");
  const range = compact.match(/(\d{1,2})[./月-](\d{1,2})(?:日)?[-~至](?:(\d{1,2})[./月-])?(\d{1,2})(?:日)?/);
  if (!range) return null;
  const startMonth = Number(range[1]);
  const endMonth = Number(range[3] || range[1]);
  const endDay = Number(range[4]);
  if (!Number.isInteger(startMonth) || !Number.isInteger(endMonth) || !Number.isInteger(endDay)) return null;
  if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12 || endDay < 1 || endDay > 31) return null;
  return { year, month: endMonth, day: endDay };
}

function findCustomerHeaderRow(sheet: ExcelJS.Worksheet) {
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 10); rowNumber += 1) {
    const values = Array.from({ length: Math.min(sheet.columnCount, 35) }, (_, index) => normalizeText(sheet.getRow(rowNumber).getCell(index + 1).value));
    const hasBlock = values.includes("板块");
    const hasLine = values.includes("二级");
    const hasChannel = values.includes("渠道");
    const hasMonthSales = values.includes("月销售额");
    if (hasBlock && hasLine && hasChannel && hasMonthSales) return rowNumber;
  }
  return null;
}

function isCustomerTotalRow(block: string, line: string, channelName: string) {
  const text = `${block} ${line} ${channelName}`.trim();
  if (!text) return true;
  return /合计|总计|subtotal|total/i.test(text);
}

function customerWeekMappings(sheet: ExcelJS.Worksheet, headerRowNumber: number, year: number, targetMonth?: number) {
  const row = sheet.getRow(headerRowNumber);
  const mappings: Array<{ sourceLabel: string; year: number; month: number; weekNumber: number; salesColumn: number; adColumn: number }> = [];
  for (let columnNumber = 1; columnNumber <= sheet.columnCount - 1; columnNumber += 1) {
    const salesHeader = normalizeText(row.getCell(columnNumber).value);
    const adHeader = normalizeText(row.getCell(columnNumber + 1).value);
    if (!/(销售|售)/.test(salesHeader) || !adHeader.includes("广告")) continue;
    const endDate = parseCustomerWeekEndMonth(salesHeader, year);
    if (!endDate || (targetMonth && endDate.month !== targetMonth)) continue;
    const weekNumber = Math.min(Math.max(Math.ceil(endDate.day / 7), 1), 5);
    mappings.push({
      sourceLabel: salesHeader.replace(/销售|售/g, ""),
      year: endDate.year,
      month: endDate.month,
      weekNumber,
      salesColumn: columnNumber,
      adColumn: columnNumber + 1,
    });
  }
  return mappings;
}

function buildRawSummary(row: Partial<ChannelImportRow>) {
  return [row.brandName, row.platformName, row.storeName || "-", row.businessLine, row.channelName, row.year, row.month]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .join(" / ");
}

function validateImportRowBasics(row: ChannelImportRow) {
  const errors: string[] = [];
  if (row.sourceType !== "customer_original") {
    if (!row.brandName) errors.push("所属品牌为空");
    if (!row.platformName) errors.push("平台为空");
    if (!row.storeName) errors.push("店铺/站点为空");
  }
  if (!row.businessLine) errors.push("二级为空");
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

export async function parseChannelImportWorkbook(fileName: string, buffer: ArrayBuffer, options: { year?: number; month?: number } = {}): Promise<ChannelImportPreview> {
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

  const sheet = workbook.getWorksheet("渠道数据导入") ?? workbook.getWorksheet("渠道效率总表") ?? workbook.worksheets[0];
  if (!sheet) throw new Error("Excel 文件中没有可读取的工作表");

  const headerRow = sheet.getRow(1);
  const headers = importHeaders.map((_, index) => normalizeText(headerRow.getCell(index + 1).value));
  const missingHeaders = importHeaders.filter((header, index) => headers[index] !== header);
  const parsedRows: ChannelImportRow[] = [];
  const rowErrors: ChannelImportErrorRow[] = [];

  if (missingHeaders.length === 0) {
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const excelRow = sheet.getRow(rowNumber);
      const values = importHeaders.map((_, index) => getCellValue(excelRow, index));
      const hasValue = values.some((value) => normalizeText(value));
      if (!hasValue) continue;

      const draft: ChannelImportRow = {
        rowNumber,
        sourceType: "standard",
        brandName: normalizeText(values[0]),
        platformName: normalizeText(values[1]),
        storeName: normalizeText(values[2]),
        businessBlock: normalizeText(values[3]),
        businessLine: normalizeText(values[4]),
        channelName: normalizeText(values[5]),
        decisionOwner: normalizeText(values[6]),
        year: 0,
        month: 0,
        currency: undefined,
        exchangeRate: undefined,
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
      sourceType: "standard",
      importYear: validRows[0]?.year,
      importMonth: validRows[0]?.month,
      weekMappings: WEEK_NUMBERS.map((weekNumber) => ({ sourceLabel: `W${weekNumber}`, weekNumber })),
      totalRows: parsedRows.length + rowErrors.length,
      validRows,
      errorRows: [...rowErrors, ...errorRows].sort((a, b) => a.rowNumber - b.rowNumber),
    };
  }

  const customerHeaderRow = findCustomerHeaderRow(sheet);
  if (!customerHeaderRow) {
    throw new Error(`导入模板表头不正确，请上传系统模板或客户渠道效率追踪表。异常字段：${missingHeaders.join("、")}`);
  }

  const { year } = parseCustomerSourceYearMonth(workbook, sheet, options.year, options.month);
  const customerCurrency = parseCustomerCurrencyAndRate(sheet);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("无法识别导入年份，请检查客户原表标题或文件信息");
  }
  const mappings = customerWeekMappings(sheet, customerHeaderRow, year);
  if (mappings.length === 0) {
    throw new Error("客户原表中没有识别到有效周销售/广告列");
  }
  const overflowMonth = Array.from(new Set(mappings.map((item) => item.month))).find((mappingMonth) => mappings.filter((item) => item.month === mappingMonth).length > WEEK_NUMBERS.length);
  if (overflowMonth) {
    throw new Error(`客户原表中 ${year}-${String(overflowMonth).padStart(2, "0")} 识别到超过 W1-W5 的周段，请确认表格周期`);
  }

  const customerHeader = sheet.getRow(customerHeaderRow);
  const headerValues = Array.from({ length: sheet.columnCount }, (_, index) => normalizeText(customerHeader.getCell(index + 1).value));
  const ratingColumn = headerValues.findIndex((value) => value === "SABC" || value === "评级") + 1;
  const actionColumn = headerValues.findIndex((value) => value === "建议动作") + 1;
  const remarkColumn = headerValues.findIndex((value) => value === "备注") + 1;

  for (let rowNumber = customerHeaderRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const excelRow = sheet.getRow(rowNumber);
    const businessBlock = normalizeText(excelRow.getCell(1).value);
    const businessLine = normalizeText(excelRow.getCell(2).value);
    const channelName = normalizeText(excelRow.getCell(3).value);
    if (!businessBlock && !businessLine && !channelName) continue;
    if (isCustomerTotalRow(businessBlock, businessLine, channelName)) continue;

    const errors: string[] = [];
    if (!businessLine) errors.push("二级为空");
    if (!channelName) errors.push("渠道为空");
    const months = Array.from(new Set(mappings.map((item) => item.month))).sort((a, b) => a - b);
    months.forEach((mappingMonth) => {
      const monthMappings = mappings.filter((item) => item.month === mappingMonth);
      const weeks = WEEK_NUMBERS.map((weekNumber) => {
        const mapping = monthMappings.find((item) => item.weekNumber === weekNumber);
        if (!mapping) return { weekNumber, salesAmountOriginal: 0, adSpendOriginal: 0 };
        const sales = parseAmount(excelRow.getCell(mapping.salesColumn).value);
        const adSpend = parseAmount(excelRow.getCell(mapping.adColumn).value);
        if (!Number.isFinite(sales)) errors.push(`${mapping.sourceLabel}销售不是数字`);
        if (!Number.isFinite(adSpend)) errors.push(`${mapping.sourceLabel}广告不是数字`);
        return {
          weekNumber,
          salesAmountOriginal: Number.isFinite(sales) ? sales : 0,
          adSpendOriginal: Number.isFinite(adSpend) ? adSpend : 0,
        };
      });

      const hasMonthValue = weeks.some((week) => week.salesAmountOriginal > 0 || week.adSpendOriginal > 0);
      if (!hasMonthValue) return;

      const draft: ChannelImportRow = {
        rowNumber,
        sourceType: "customer_original",
        brandName: "",
        platformName: "",
        storeName: "",
        businessBlock,
        businessLine,
        channelName,
        decisionOwner: "",
        year,
        month: mappingMonth,
        currency: customerCurrency.currency,
        exchangeRate: customerCurrency.exchangeRate,
        weeks,
        manualRating: ratingColumn > 0 ? normalizeText(excelRow.getCell(ratingColumn).value) : "",
        manualActionSuggestion: actionColumn > 0 ? normalizeText(excelRow.getCell(actionColumn).value) : "",
        decisionDeadline: "",
        remark: remarkColumn > 0 ? normalizeText(excelRow.getCell(remarkColumn).value) : "",
        rawSummary: "",
      };
      draft.rawSummary = buildRawSummary(draft);
      if (errors.length > 0) rowErrors.push({ rowNumber, errors, rawSummary: draft.rawSummary });
      else parsedRows.push(draft);
    });
  }

  const { validRows, errorRows } = await validateImportRows(parsedRows);
  const importedMonths = Array.from(new Set(validRows.map((row) => row.month))).sort((a, b) => a - b);
  const latestMonth = importedMonths.at(-1);
  return {
    fileName,
    sourceType: "customer_original",
    importYear: year,
    importMonth: latestMonth,
    weekMappings: mappings.map((item) => ({ sourceLabel: `${year}-${String(item.month).padStart(2, "0")} ${item.sourceLabel}`, weekNumber: item.weekNumber })),
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
  if (row.sourceType === "customer_original") {
    const select = {
      id: true,
      brandId: true,
      platformId: true,
      storeId: true,
      businessLine: true,
      channelGroup: true,
      channelType: true,
      channelName: true,
      platform: { select: { id: true, name: true } },
      store: { select: { id: true, name: true, primaryMarketCode: true, defaultCurrency: true, storeType: true } },
      brand: { select: { id: true, name: true, defaultCurrency: true } },
    } satisfies Prisma.ChannelSelect;
    const text = (value: string | null | undefined) => (value || "").trim().toLowerCase();
    const compact = (value: string | null | undefined) => text(value).replace(/[（(].*?[）)]/g, "").replace(/[\s/_-]/g, "");
    const includes = (source: string | null | undefined, target: string) => {
      const sourceText = compact(source);
      const targetText = compact(target);
      return Boolean(sourceText && targetText && (sourceText.includes(targetText) || targetText.includes(sourceText)));
    };
    const candidates = await prisma.channel.findMany({
      where: {
        status: "active",
      },
      select,
    });
    const exactStoreMatches = candidates.filter((channel) => includes(channel.store?.name, row.businessLine) && (includes(channel.channelName, row.channelName) || includes(channel.channelGroup, row.channelName)));
    const lineMatches = candidates.filter((channel) => includes(channel.businessLine, row.businessLine) && includes(channel.channelName, row.channelName));
    const channelMatches = candidates.filter((channel) => channel.channelName === row.channelName || includes(channel.channelGroup, row.channelName));
    const channels = exactStoreMatches.length ? exactStoreMatches : lineMatches.length ? lineMatches : channelMatches;
    if (channels.length === 0) errors.push("未找到匹配渠道，请检查基础资料中的店铺/二级/渠道名称");
    if (channels.length > 1) errors.push("渠道匹配不唯一，请使用系统标准模板补充品牌/平台/店铺后导入");
    return {
      errors,
      channel: channels[0] ?? null,
      brand: channels[0]?.brand ? { id: channels[0].brand.id, name: channels[0].brand.name, defaultCurrency: channels[0].brand.defaultCurrency } : null,
      platform: channels[0]?.platform ?? null,
      store: channels[0]?.store ?? null,
    };
  }

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

async function getImportFallbackBase() {
  const [brand, platform] = await Promise.all([
    prisma.brand.findFirst({ where: { status: "active" }, orderBy: { id: "asc" }, select: { id: true, name: true, defaultCurrency: true } }),
    prisma.platform.findFirst({ where: { status: "active" }, orderBy: { id: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!brand || !platform) throw new Error("缺少可用品牌或平台，请先维护基础资料");
  return { brand, platform };
}

async function ensureCustomerImportChannel(row: ChannelImportRow) {
  const resolved = await resolveImportRow(row);
  if (resolved.channel && resolved.errors.length === 0 && resolved.channel.brandId && resolved.channel.platformId) return resolved;
  if (row.sourceType !== "customer_original") return resolved;
  if (resolved.errors.some((error) => error.includes("不唯一"))) return resolved;

  const { brand, platform } = await getImportFallbackBase();
  const existing = await prisma.channel.findFirst({
    where: {
      businessLine: row.businessLine,
      channelName: row.channelName,
      storeId: null,
    },
    select: {
      id: true,
      brandId: true,
      platformId: true,
      storeId: true,
      businessLine: true,
      channelGroup: true,
      channelType: true,
      channelName: true,
      platform: { select: { id: true, name: true } },
      store: { select: { id: true, name: true, primaryMarketCode: true, defaultCurrency: true, storeType: true } },
      brand: { select: { id: true, name: true, defaultCurrency: true } },
    },
  });
  const channel = existing ?? await prisma.channel.create({
    data: {
      brandId: brand.id,
      platformId: platform.id,
      storeId: null,
      businessLine: row.businessLine,
      channelGroup: row.businessBlock || row.businessLine,
      channelName: row.channelName,
      channelType: "manual",
      status: "active",
    },
    select: {
      id: true,
      brandId: true,
      platformId: true,
      storeId: true,
      businessLine: true,
      channelGroup: true,
      channelType: true,
      channelName: true,
      platform: { select: { id: true, name: true } },
      store: { select: { id: true, name: true, primaryMarketCode: true, defaultCurrency: true, storeType: true } },
      brand: { select: { id: true, name: true, defaultCurrency: true } },
    },
  });

  return { errors: [], channel, brand, platform, store: null };
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

    if (row.sourceType === "customer_original") {
      validRows.push(row);
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
    const resolved = row.sourceType === "customer_original" ? await ensureCustomerImportChannel(row) : await resolveImportRow(row);
    const channel = resolved.channel;
    if (!channel || resolved.errors.length > 0 || !channel.brandId || !channel.platformId) {
      failedErrors.push({ rowNumber: row.rowNumber, errors: resolved.errors.length ? resolved.errors : ["渠道数据不完整"], rawSummary: row.rawSummary });
      continue;
    }

    try {
      const quarter = quarterFromMonth(row.month);
      const brandId = channel.brandId;
      const platformId = channel.platformId;
      const currency = row.currency || channel.store?.defaultCurrency || channel.brand?.defaultCurrency || "CNY";
      const exchangeRate = Math.max(toNumber(row.exchangeRate, 1), 0) || 1;
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
              exchangeRate: new Prisma.Decimal(exchangeRate.toFixed(6)),
              salesAmountBase: toDecimal(salesAmount * exchangeRate),
              adSpendBase: toDecimal(adSpend * exchangeRate),
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
              exchangeRate: new Prisma.Decimal(exchangeRate.toFixed(6)),
              salesAmountBase: toDecimal(salesAmount * exchangeRate),
              adSpendBase: toDecimal(adSpend * exchangeRate),
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
