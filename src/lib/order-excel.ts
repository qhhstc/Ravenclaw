import ExcelJS from "exceljs";
import { buildOrderWhere, orderDetailInclude, toNumber } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/permissions";

const moneyFormat = "#,##0.00";
const percentFormat = "0.0%";

// 与 src/components/orders/orderOptions.tsx 的标签保持一致（此处为服务端导出内联，避免引入 client 模块）
const ORDER_SOURCE_LABELS: Record<string, string> = { calembou: "Calembou", kidultsbox: "Kidultsbox" };
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: "待付款",
  paid: "已付款",
  preparing: "备货中",
  shipped: "已发货",
  in_transit: "运输中",
  customs_clearance: "清关中",
  delivered: "已签收",
  completed: "已完成",
  after_sales_reship: "售后补发",
  cancelled: "已取消",
  refunded: "已退款",
  draft: "草稿",
  pending_confirm: "待确认",
  confirmed: "已确认",
  processing: "处理中",
};
const PAYMENT_STATUS_LABELS: Record<string, string> = { unpaid: "未付款", partial_paid: "部分付款", paid: "已付款", refunded: "已退款" };
const SHIPPING_STATUS_LABELS: Record<string, string> = { unshipped: "未发货", partial_shipped: "部分发货", shipped: "已发货", delivered: "已签收" };

function labelOf(map: Record<string, string>, value?: string | null) {
  if (!value) return "-";
  return map[value] ?? value;
}

function channelText(channel?: { businessLine?: string | null; channelName?: string | null; store?: { name?: string | null } | null } | null) {
  if (!channel) return "-";
  const store = channel.store?.name ? ` / ${channel.store.name}` : "";
  return `${channel.businessLine ?? ""}${store} / ${channel.channelName ?? ""}`;
}

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

// 表头：订单头信息 + 商品明细（每个产品一行，订单头字段在该订单每行重复填充）
const HEADERS = [
  "订单编号",
  "外部订单号",
  "订单来源",
  "客户名称",
  "业务员",
  "品牌",
  "平台",
  "店铺/站点",
  "来源渠道",
  "关联红人",
  "国家",
  "订单状态",
  "付款状态",
  "发货状态",
  "下单日期",
  "出货日期",
  "预计发货",
  "实际发货",
  "应收款到期",
  "收款方式",
  "物流商",
  "物流单号",
  "币种",
  "本位币",
  "汇率",
  "销售总金额（订单币种）",
  "总成本（本位币）",
  "毛利（本位币）",
  "毛利率",
  "已收金额（订单币种）",
  "未收金额（订单币种）",
  "SKU",
  "中文名称",
  "英文名称",
  "规格",
  "数量",
  "销售单价（订单币种）",
  "销售小计（订单币种）",
  "采购单价（采购币种）",
  "采购币种",
  "采购成本小计（采购币种）",
  "采购成本（本位币）",
  "包装单价（包装币种）",
  "包装币种",
  "包装成本小计（包装币种）",
  "包装成本（本位币）",
  "商品备注",
  "订单备注",
  "创建时间",
  "更新时间",
];

// 1-based 列索引
const MONEY_COLUMNS = [26, 27, 28, 30, 31, 37, 38, 39, 41, 42, 43, 45, 46];
const DATE_COLUMNS = [15, 16, 17, 18, 19];
const DATETIME_COLUMNS = [49, 50];
const GROSS_PROFIT_COLUMN = 28;
const GROSS_MARGIN_COLUMN = 29;
const EXCHANGE_RATE_COLUMN = 25;
// 订单头列(1-31)与订单尾列(48-50)：同一订单跨多产品行时垂直合并；明细列(32-47)逐行各自显示
const ORDER_HEAD_COLUMNS = Array.from({ length: 31 }, (_, i) => i + 1);
const ORDER_TAIL_COLUMNS = [48, 49, 50];
const COLUMN_WIDTHS = [
  18, 16, 11, 24, 12, 12, 12, 16, 24, 18, 8, 11, 11, 11, 13, 13, 13, 13, 13, 14, 14, 16, 8, 8, 12,
  16, 14, 14, 9, 14, 14, 14, 22, 26, 14, 8, 14, 14, 14, 10, 16, 14, 14, 10, 16, 14, 22, 28, 17, 17,
];

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
  const sheet = workbook.addWorksheet("订单明细", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow(HEADERS);
  styleHeader(sheet.getRow(1));

  orders.forEach((order) => {
    const influencer = order.influencerCollaboration
      ? `${order.influencerCollaboration.influencerName}${order.influencerCollaboration.accountHandle ? ` / ${order.influencerCollaboration.accountHandle}` : ""}`
      : "-";
    const orderHead = [
      order.orderNo,
      order.externalOrderNo || "",
      labelOf(ORDER_SOURCE_LABELS, order.orderSource),
      order.customerName || order.customer?.name || "散客/平台订单",
      order.salesperson?.name || order.creator?.name || "",
      order.brand?.name || "",
      order.platform?.name || "",
      order.store?.name || "",
      channelText(order.channel),
      influencer,
      order.countryCode || "",
      labelOf(ORDER_STATUS_LABELS, order.orderStatus),
      labelOf(PAYMENT_STATUS_LABELS, order.paymentStatus),
      labelOf(SHIPPING_STATUS_LABELS, order.shippingStatus),
      order.orderDate,
      order.shipmentDate,
      order.expectedShipDate,
      order.actualShipDate,
      order.dueDate,
      order.paymentMethod || "",
      order.logisticsProvider || "",
      order.trackingNo || "",
      order.currency,
      order.baseCurrency,
      toNumber(order.exchangeRate, 1),
      toNumber(order.salesAmount),
      toNumber(order.totalCost),
      toNumber(order.grossProfit),
      order.grossMargin == null ? null : toNumber(order.grossMargin),
      toNumber(order.paidAmount),
      toNumber(order.unpaidAmount),
    ];
    const orderTail = [order.remark || "", order.createdAt, order.updatedAt];

    // 无商品明细的订单仍输出一行，明细列留空，避免漏单
    const items = order.items.length ? order.items : [null];
    const startRow = sheet.rowCount + 1;
    items.forEach((item) => {
      const itemCells = item
        ? [
            item.sku || "",
            item.productNameCn || "",
            item.productNameEn || item.productName || "",
            item.specification || "",
            item.quantity,
            toNumber(item.saleUnitPrice),
            toNumber(item.salesSubtotal),
            toNumber(item.purchaseUnitCost),
            item.purchaseCurrency || "",
            toNumber(item.purchaseCostSubtotal),
            toNumber(item.purchaseCostBase),
            toNumber(item.packagingUnitCost),
            item.packagingCurrency || "",
            toNumber(item.packagingCostSubtotal),
            toNumber(item.packagingCostBase),
            item.remark || "",
          ]
        : ["", "", "", "", null, null, null, null, "", null, null, null, "", null, null, ""];
      const row = sheet.addRow([...orderHead, ...itemCells, ...orderTail]);
      DATE_COLUMNS.forEach((col) => (row.getCell(col).numFmt = "yyyy-mm-dd"));
      DATETIME_COLUMNS.forEach((col) => (row.getCell(col).numFmt = "yyyy-mm-dd hh:mm"));
      row.getCell(EXCHANGE_RATE_COLUMN).numFmt = "0.000000";
      row.getCell(GROSS_MARGIN_COLUMN).numFmt = percentFormat;
      if (toNumber(order.grossProfit) < 0) row.getCell(GROSS_PROFIT_COLUMN).font = { color: { argb: "FFFF4D4F" }, bold: true };
      if (order.grossMargin != null && toNumber(order.grossMargin) < 0.2) row.getCell(GROSS_MARGIN_COLUMN).font = { color: { argb: "FFFA8C16" }, bold: true };
    });

    // 同一订单跨多个产品行时，把订单头/订单尾列垂直合并，订单信息只显示一次
    const endRow = sheet.rowCount;
    if (endRow > startRow) {
      [...ORDER_HEAD_COLUMNS, ...ORDER_TAIL_COLUMNS].forEach((col) => {
        sheet.mergeCells(startRow, col, endRow, col);
        sheet.getCell(startRow, col).alignment = { vertical: "top", wrapText: true };
      });
    }
  });

  setWidths(sheet, COLUMN_WIDTHS);
  styleMoneyColumns(sheet, MONEY_COLUMNS);
  return workbook;
}

export function orderExportFileName() {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `订单明细_${stamp}.xlsx`;
}
