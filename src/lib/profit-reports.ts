import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { BASE_CURRENCY } from "@/lib/order-profit-calculations";
import { toNumber } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/permissions";

const costTypeLabels: Record<string, string> = {
  product_purchase: "产品采购成本",
  domestic_shipping: "国内运费",
  packaging_material: "包装耗材成本",
  international_shipping: "国际运费",
  customs_fee: "清关费",
  port_charge: "港杂费",
  trucking_fee: "拖车费",
  platform_fee: "平台手续费",
  payment_fee: "支付手续费",
  other: "其他杂费",
};

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function profitReportWhere(params: URLSearchParams): Prisma.OrderWhereInput {
  const now = new Date();
  const year = Number(params.get("year")) || now.getUTCFullYear();
  const month = params.get("month") ? Number(params.get("month")) : null;
  const dateFrom = parseDate(params.get("dateFrom")) ?? new Date(Date.UTC(year, month ? month - 1 : 0, 1));
  const dateTo = parseDate(params.get("dateTo")) ?? new Date(Date.UTC(year, month ? month : 12, 1));
  return {
    orderDate: { gte: dateFrom, lt: dateTo },
    orderStatus: { notIn: ["cancelled", "refunded"] },
  };
}

function baseAmount(value: unknown, exchangeRate: unknown) {
  return toNumber(value) * (toNumber(exchangeRate, 1) || 1);
}

function summarizeOrders(orders: Array<{ salesAmount: unknown; totalCost: unknown; grossProfit: unknown; exchangeRate?: unknown }>) {
  const salesAmount = orders.reduce((sum, order) => sum + baseAmount(order.salesAmount, order.exchangeRate), 0);
  const totalCost = orders.reduce((sum, order) => sum + toNumber(order.totalCost), 0);
  const grossProfit = orders.reduce((sum, order) => sum + toNumber(order.grossProfit), 0);
  return {
    orderCount: orders.length,
    salesAmount,
    totalCost,
    grossProfit,
    grossMargin: salesAmount > 0 ? grossProfit / salesAmount : null,
  };
}

function reportBaseCurrency(orders: Array<{ baseCurrency?: string | null }>) {
  return orders.find((order) => order.baseCurrency)?.baseCurrency ?? BASE_CURRENCY;
}

function startOfUtcWeek(date: Date) {
  const day = date.getUTCDay() || 7;
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - day + 1);
  return monday;
}

function groupKey(date: Date, dimension: string) {
  if (dimension === "daily") return date.toISOString().slice(0, 10);
  if (dimension === "weekly") return `${startOfUtcWeek(date).toISOString().slice(0, 10)} 周`;
  if (dimension === "yearly") return String(date.getUTCFullYear());
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getProfitReport(params: URLSearchParams, session: SessionUser) {
  void session;
  const where = profitReportWhere(params);
  const orders = await prisma.order.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, companyName: true } },
      salesperson: { select: { id: true, name: true } },
      items: true,
      costs: true,
    },
    orderBy: [{ orderDate: "desc" }, { id: "desc" }],
  });

  const dailyMap = new Map<string, typeof orders>();
  const weeklyMap = new Map<string, typeof orders>();
  const monthlyMap = new Map<string, typeof orders>();
  const yearlyMap = new Map<string, typeof orders>();
  const customerMap = new Map<string, typeof orders>();
  const productMap = new Map<string, { sku: string; productName: string; quantity: number; salesAmount: number; purchaseCost: number; packagingCost: number }>();
  const costMap = new Map<string, number>();

  orders.forEach((order) => {
    const orderDate = new Date(order.orderDate);
    [
      [dailyMap, groupKey(orderDate, "daily")],
      [weeklyMap, groupKey(orderDate, "weekly")],
      [monthlyMap, groupKey(orderDate, "monthly")],
      [yearlyMap, groupKey(orderDate, "yearly")],
    ].forEach(([map, key]) => {
      const typedMap = map as Map<string, typeof orders>;
      typedMap.set(String(key), [...(typedMap.get(String(key)) ?? []), order]);
    });
    const customerName = order.customerName || order.customer?.name || "散客/平台订单";
    customerMap.set(customerName, [...(customerMap.get(customerName) ?? []), order]);
    order.items.forEach((item) => {
      const key = item.sku || item.productName;
      const current = productMap.get(key) ?? { sku: item.sku || "-", productName: item.productName, quantity: 0, salesAmount: 0, purchaseCost: 0, packagingCost: 0 };
      current.quantity += Number(item.quantity) || 0;
      current.salesAmount += baseAmount(item.salesSubtotal, order.exchangeRate);
      current.purchaseCost += toNumber(item.purchaseCostBase);
      current.packagingCost += toNumber(item.packagingCostBase);
      productMap.set(key, current);
    });
    order.costs.forEach((cost) => {
      costMap.set(cost.costType, (costMap.get(cost.costType) ?? 0) + toNumber(cost.baseAmount));
    });
  });

  const byOrderSummary = (entries: IterableIterator<[string, typeof orders]>) =>
    Array.from(entries).map(([name, list]) => ({ name, ...summarizeOrders(list) })).sort((a, b) => a.name.localeCompare(b.name));

  const productRanking = Array.from(productMap.values())
    .map((item) => {
      const totalCost = item.purchaseCost + item.packagingCost;
      const grossProfit = item.salesAmount - totalCost;
      return {
        ...item,
        totalCost,
        grossProfit,
        grossMargin: item.salesAmount > 0 ? grossProfit / item.salesAmount : null,
      };
    })
    .sort((a, b) => b.grossProfit - a.grossProfit);

  const totalCostAmount = Array.from(costMap.values()).reduce((sum, amount) => sum + amount, 0);
  const costComposition = Array.from(costMap.entries()).map(([costType, amount]) => ({
    costType,
    name: costTypeLabels[costType] ?? costType,
    amount,
    ratio: totalCostAmount > 0 ? amount / totalCostAmount : null,
  })).sort((a, b) => b.amount - a.amount);

  return {
    baseCurrency: reportBaseCurrency(orders),
    summary: summarizeOrders(orders),
    daily: byOrderSummary(dailyMap.entries()),
    weekly: byOrderSummary(weeklyMap.entries()),
    monthly: byOrderSummary(monthlyMap.entries()),
    yearly: byOrderSummary(yearlyMap.entries()),
    costComposition,
    customerRanking: byOrderSummary(customerMap.entries()).sort((a, b) => b.grossProfit - a.grossProfit).slice(0, 20),
    productRanking: productRanking.slice(0, 20),
    orderDetails: orders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      customerName: order.customerName || order.customer?.name || "散客/平台订单",
      orderDate: order.orderDate,
      salesAmount: baseAmount(order.salesAmount, order.exchangeRate),
      totalCost: toNumber(order.totalCost),
      grossProfit: toNumber(order.grossProfit),
      grossMargin: order.grossMargin == null ? null : toNumber(order.grossMargin),
      salespersonName: order.salesperson?.name ?? "",
      orderStatus: order.orderStatus,
    })),
  };
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
  row.alignment = { horizontal: "center" };
}

function addSummarySheet(workbook: ExcelJS.Workbook, name: string, rows: Array<Record<string, unknown>>, headers: Array<[string, string]>) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow(headers.map(([title]) => title));
  styleHeader(sheet.getRow(1));
  rows.forEach((row) => sheet.addRow(headers.map(([, key]) => row[key])));
  sheet.columns.forEach((column) => {
    column.width = Math.max(12, String(column.header ?? "").length + 6);
  });
  headers.forEach(([, key], index) => {
    if (["salesAmount", "totalCost", "grossProfit", "amount", "purchaseCost", "packagingCost"].includes(key)) sheet.getColumn(index + 1).numFmt = "#,##0.00";
    if (["grossMargin", "ratio"].includes(key)) sheet.getColumn(index + 1).numFmt = "0.00%";
  });
  return sheet;
}

export async function createProfitReportWorkbook(params: URLSearchParams, session: SessionUser, type = "orders") {
  const report = await getProfitReport(params, session);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Ravenclaw";
  workbook.created = new Date();
  const baseCurrencyLabel = `本位币 ${report.baseCurrency}`;
  const headers: Record<string, Array<[string, string]>> = {
    daily: [["日期", "name"], ["订单数", "orderCount"], [`销售额（${baseCurrencyLabel}）`, "salesAmount"], [`总成本（${baseCurrencyLabel}）`, "totalCost"], [`毛利（${baseCurrencyLabel}）`, "grossProfit"], ["毛利率", "grossMargin"]],
    weekly: [["周", "name"], ["订单数", "orderCount"], [`销售额（${baseCurrencyLabel}）`, "salesAmount"], [`总成本（${baseCurrencyLabel}）`, "totalCost"], [`毛利（${baseCurrencyLabel}）`, "grossProfit"], ["毛利率", "grossMargin"]],
    monthly: [["月份", "name"], ["订单数", "orderCount"], [`销售额（${baseCurrencyLabel}）`, "salesAmount"], [`总成本（${baseCurrencyLabel}）`, "totalCost"], [`毛利（${baseCurrencyLabel}）`, "grossProfit"], ["毛利率", "grossMargin"]],
    yearly: [["年份", "name"], ["订单数", "orderCount"], [`销售额（${baseCurrencyLabel}）`, "salesAmount"], [`总成本（${baseCurrencyLabel}）`, "totalCost"], [`毛利（${baseCurrencyLabel}）`, "grossProfit"], ["毛利率", "grossMargin"]],
    costs: [["成本类型", "name"], [`金额（${baseCurrencyLabel}）`, "amount"], ["占总成本比例", "ratio"]],
    customers: [["客户名称", "name"], ["订单数", "orderCount"], [`销售额（${baseCurrencyLabel}）`, "salesAmount"], [`总成本（${baseCurrencyLabel}）`, "totalCost"], [`毛利（${baseCurrencyLabel}）`, "grossProfit"], ["毛利率", "grossMargin"]],
    products: [["SKU", "sku"], ["产品名称", "productName"], ["销售数量", "quantity"], [`销售额（${baseCurrencyLabel}）`, "salesAmount"], [`采购成本（${baseCurrencyLabel}）`, "purchaseCost"], [`包装成本（${baseCurrencyLabel}）`, "packagingCost"], [`毛利（${baseCurrencyLabel}）`, "grossProfit"], ["毛利率", "grossMargin"]],
    orders: [["订单编号", "orderNo"], ["客户名称", "customerName"], ["下单日期", "orderDate"], [`销售额（${baseCurrencyLabel}）`, "salesAmount"], [`总成本（${baseCurrencyLabel}）`, "totalCost"], [`毛利（${baseCurrencyLabel}）`, "grossProfit"], ["毛利率", "grossMargin"], ["业务员", "salespersonName"], ["订单状态", "orderStatus"]],
  };
  const data: Record<string, Array<Record<string, unknown>>> = {
    daily: report.daily,
    weekly: report.weekly,
    monthly: report.monthly,
    yearly: report.yearly,
    costs: report.costComposition,
    customers: report.customerRanking,
    products: report.productRanking,
    orders: report.orderDetails,
  };
  addSummarySheet(workbook, "利润报表", data[type] ?? data.orders, headers[type] ?? headers.orders);
  return workbook;
}

export function profitExportFileName(type: string, year: string | null) {
  const labelMap: Record<string, string> = {
    daily: "每日利润统计",
    weekly: "每周利润统计",
    monthly: "月度利润统计",
    yearly: "年度利润统计",
    costs: "成本构成表",
    customers: "客户利润排行",
    products: "产品利润排行",
    orders: "订单利润明细",
  };
  return `${labelMap[type] ?? "利润报表"}_${year || new Date().getUTCFullYear()}.xlsx`;
}
