import ExcelJS from "exceljs";
import { buildOrderWhere, orderDetailInclude, toNumber } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/permissions";

const moneyFormat = "#,##0.00";
const percentFormat = "0.0%";

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

function styleMoneyColumns(sheet: ExcelJS.Worksheet, columns: number[]) {
  columns.forEach((columnIndex) => {
    sheet.getColumn(columnIndex).numFmt = moneyFormat;
    sheet.getColumn(columnIndex).alignment = { horizontal: "right" };
  });
}

function setWidths(sheet: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

export async function workbookToResponse(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const encoded = encodeURIComponent(filename);
  return new Response(new Blob([buffer as BlobPart], { type: contentType }), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename=\"orders.xlsx\"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "no-store",
    },
  });
}

export async function createOrderListWorkbook(params: URLSearchParams, session: SessionUser) {
  const where = buildOrderWhere(params, session);
  const orders = await prisma.order.findMany({
    where,
    include: orderDetailInclude,
    orderBy: [{ orderDate: "desc" }, { id: "desc" }],
  });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Ravenclaw";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("订单列表", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow([
    "订单编号",
    "客户名称",
    "下单日期",
    "出货日期",
    "产品摘要",
    "币种",
    "本位币",
    "销售总金额",
    "总成本",
    "毛利",
    "毛利率",
    "已收金额",
    "未收金额",
    "订单状态",
    "付款状态",
    "业务员",
    "备注",
  ]);
  styleHeader(sheet.getRow(1));
  orders.forEach((order) => {
    const productSummary = order.items.map((item) => `${item.productName}×${item.quantity}`).join("；");
    const row = sheet.addRow([
      order.orderNo,
      order.customerName || order.customer?.name || "散客/平台订单",
      order.orderDate,
      order.shipmentDate,
      productSummary,
      order.currency,
      order.baseCurrency,
      toNumber(order.salesAmount),
      toNumber(order.totalCost),
      toNumber(order.grossProfit),
      order.grossMargin == null ? null : toNumber(order.grossMargin),
      toNumber(order.paidAmount),
      toNumber(order.unpaidAmount),
      order.orderStatus,
      order.paymentStatus,
      order.salesperson?.name || order.creator?.name || "",
      order.remark || "",
    ]);
    row.getCell(3).numFmt = "yyyy-mm-dd";
    row.getCell(4).numFmt = "yyyy-mm-dd";
    row.getCell(11).numFmt = percentFormat;
    if (toNumber(order.grossProfit) < 0) row.getCell(10).font = { color: { argb: "FFFF4D4F" }, bold: true };
    if (order.grossMargin != null && toNumber(order.grossMargin) < 0.2) row.getCell(11).font = { color: { argb: "FFFA8C16" }, bold: true };
  });
  const totalRow = sheet.addRow([
    "合计",
    "",
    "",
    "",
    "",
    "",
    "",
    orders.reduce((sum, order) => sum + toNumber(order.salesAmount), 0),
    orders.reduce((sum, order) => sum + toNumber(order.totalCost), 0),
    orders.reduce((sum, order) => sum + toNumber(order.grossProfit), 0),
    null,
    orders.reduce((sum, order) => sum + toNumber(order.paidAmount), 0),
    orders.reduce((sum, order) => sum + toNumber(order.unpaidAmount), 0),
  ]);
  totalRow.font = { bold: true };
  totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7E6" } };
  setWidths(sheet, [18, 26, 13, 13, 42, 9, 9, 14, 14, 14, 11, 14, 14, 14, 14, 14, 28]);
  styleMoneyColumns(sheet, [8, 9, 10, 12, 13]);
  return workbook;
}

export function orderExportFileName(params: URLSearchParams) {
  const now = new Date();
  const year = params.get("year") || String(now.getFullYear());
  const month = params.get("month") || String(now.getMonth() + 1).padStart(2, "0");
  return `订单列表_${year}-${String(month).padStart(2, "0")}.xlsx`;
}
