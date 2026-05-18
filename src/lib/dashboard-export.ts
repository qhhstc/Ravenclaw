import ExcelJS from "exceljs";
import { getDashboardOverviewData, type DashboardOverviewFilters } from "@/lib/dashboard-overview";

const moneyFormat = "#,##0.00";
const percentFormat = "0.0%";
const ratioFormat = "0.00";

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FF172033" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FFD8DEE8" } },
      left: { style: "thin", color: { argb: "FFD8DEE8" } },
      bottom: { style: "thin", color: { argb: "FFD8DEE8" } },
      right: { style: "thin", color: { argb: "FFD8DEE8" } },
    };
  });
}

function addHeader(sheet: ExcelJS.Worksheet, headers: string[]) {
  sheet.addRow(headers);
  styleHeader(sheet.getRow(1));
}

function formatColumns(sheet: ExcelJS.Worksheet, moneyColumns: number[] = [], percentColumns: number[] = [], ratioColumns: number[] = []) {
  moneyColumns.forEach((index) => {
    sheet.getColumn(index).numFmt = moneyFormat;
    sheet.getColumn(index).alignment = { horizontal: "right" };
  });
  percentColumns.forEach((index) => {
    sheet.getColumn(index).numFmt = percentFormat;
    sheet.getColumn(index).alignment = { horizontal: "right" };
  });
  ratioColumns.forEach((index) => {
    sheet.getColumn(index).numFmt = ratioFormat;
    sheet.getColumn(index).alignment = { horizontal: "right" };
  });
}

function setWidths(sheet: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

export async function createDashboardOverviewWorkbook(filters: DashboardOverviewFilters) {
  const data = await getDashboardOverviewData(filters);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Ravenclaw";
  workbook.created = new Date();

  const kpiSheet = workbook.addWorksheet("经营总览", { views: [{ state: "frozen", ySplit: 1 }] });
  addHeader(kpiSheet, ["指标", "数值"]);
  [
    ["本月销售额", data.kpis.salesAmount],
    ["本月广告费", data.kpis.adSpend],
    ["整体 ROI", data.kpis.roi],
    ["广告占比", data.kpis.adSpendRatio],
    ["渠道数量", data.kpis.channelCount],
    ["有广告费渠道数", data.kpis.paidChannelCount],
    ["净利润", data.kpis.netProfit],
    ["应收账款", data.kpis.receivableAmount],
    ["应收订单数", data.kpis.receivableCount],
  ].forEach((row) => kpiSheet.addRow(row));
  setWidths(kpiSheet, [24, 18]);
  kpiSheet.getColumn(2).alignment = { horizontal: "right" };
  [2, 3, 8, 9].forEach((rowNumber) => {
    kpiSheet.getRow(rowNumber).getCell(2).numFmt = moneyFormat;
  });
  [4].forEach((rowNumber) => {
    kpiSheet.getRow(rowNumber).getCell(2).numFmt = ratioFormat;
  });
  [5].forEach((rowNumber) => {
    kpiSheet.getRow(rowNumber).getCell(2).numFmt = percentFormat;
  });

  const trendSheet = workbook.addWorksheet("周趋势", { views: [{ state: "frozen", ySplit: 1 }] });
  addHeader(trendSheet, ["周", "销售额", "广告费"]);
  data.weeklyTrend.forEach((row) => trendSheet.addRow([row.week, row.salesAmount, row.adSpend]));
  setWidths(trendSheet, [12, 16, 16]);
  formatColumns(trendSheet, [2, 3]);

  const shareSheet = workbook.addWorksheet("渠道销售占比", { views: [{ state: "frozen", ySplit: 1 }] });
  addHeader(shareSheet, ["业务线", "销售额", "占比"]);
  data.businessLineShare.forEach((row) => shareSheet.addRow([row.name, row.salesAmount, row.ratio]));
  setWidths(shareSheet, [24, 16, 12]);
  formatColumns(shareSheet, [2], [3]);

  const roiSheet = workbook.addWorksheet("ROI排行", { views: [{ state: "frozen", ySplit: 1 }] });
  addHeader(roiSheet, ["排名", "渠道", "店铺", "销售额", "广告费", "ROI"]);
  data.roiRanking.forEach((row) => roiSheet.addRow([row.rank, row.channelName, row.storeName, row.salesAmount, row.adSpend, row.roi]));
  setWidths(roiSheet, [10, 26, 22, 16, 16, 10]);
  formatColumns(roiSheet, [4, 5], [], [6]);

  const weeklySheet = workbook.addWorksheet("渠道周数据", { views: [{ state: "frozen", ySplit: 1 }] });
  addHeader(weeklySheet, ["业务线", "渠道", "店铺", "W1销售", "W1广告", "W2销售", "W2广告", "W3销售", "W3广告", "W4销售", "W4广告", "W5销售", "W5广告", "月销售", "月广告", "ROI"]);
  data.weeklyTable.forEach((row) => {
    weeklySheet.addRow([
      row.businessLine,
      row.channelName,
      row.storeName,
      row.weeks["1"]?.salesAmount ?? 0,
      row.weeks["1"]?.adSpend ?? 0,
      row.weeks["2"]?.salesAmount ?? 0,
      row.weeks["2"]?.adSpend ?? 0,
      row.weeks["3"]?.salesAmount ?? 0,
      row.weeks["3"]?.adSpend ?? 0,
      row.weeks["4"]?.salesAmount ?? 0,
      row.weeks["4"]?.adSpend ?? 0,
      row.weeks["5"]?.salesAmount ?? 0,
      row.weeks["5"]?.adSpend ?? 0,
      row.monthSales,
      row.monthAdSpend,
      row.roi,
    ]);
  });
  setWidths(weeklySheet, [16, 26, 22, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 16, 16, 10]);
  formatColumns(weeklySheet, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], [], [16]);

  return workbook;
}

export function dashboardOverviewExportFileName(filters: DashboardOverviewFilters) {
  return `经营看板_${filters.year}-${String(filters.month).padStart(2, "0")}.xlsx`;
}
