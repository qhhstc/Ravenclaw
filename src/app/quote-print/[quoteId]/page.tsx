import { notFound } from "next/navigation";
import QuotePrintActions from "@/components/quotes/QuotePrintActions";
import { requireUser } from "@/lib/auth";
import { toNumber } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ quoteId: string }> };

const statusLabels: Record<string, string> = {
  draft: "草稿",
  sent: "已发送",
  accepted: "已接受",
  converted: "已转订单",
  rejected: "已拒绝",
};

function moneyText(value: unknown, currency = "USD") {
  return `${currency} ${toNumber(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateText(value?: Date | string | null) {
  return value ? new Date(value).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }) : "-";
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

export default async function QuotePrintPage({ params }: Props) {
  await requireUser();
  const { quoteId } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id: Number(quoteId) },
    include: {
      customer: { select: { name: true, companyName: true, email: true, phone: true, whatsapp: true, countryCode: true } },
      inquiry: { select: { inquiryNo: true, title: true, content: true } },
      brand: { select: { name: true, website: true } },
      platform: { select: { name: true } },
      store: { select: { name: true, domain: true, defaultCurrency: true } },
      channel: { select: { businessLine: true, channelName: true } },
      items: { orderBy: { id: "asc" } },
      order: { select: { id: true, orderNo: true } },
    },
  });

  if (!quote) notFound();

  const customerName = quote.customer?.companyName || quote.customer?.name || "客户";
  const sellerName = quote.store?.name || quote.brand?.name || "Ravenclaw";
  const sellerSite = quote.store?.domain || quote.brand?.website || "";
  const validUntil = addDays(quote.createdAt, 15);

  return (
    <main className="quote-print-page">
      <style>{`
        :root {
          color: #18212f;
          background: #eef2f7;
          font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif;
        }
        body {
          margin: 0;
          background: #eef2f7;
        }
        .quote-print-page {
          min-height: 100vh;
          padding: 28px;
        }
        .quote-actions {
          max-width: 980px;
          margin: 0 auto 16px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
        }
        .quote-actions button,
        .quote-actions a {
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          padding: 8px 14px;
          background: #ffffff;
          color: #0f172a;
          text-decoration: none;
          font-size: 14px;
          cursor: pointer;
        }
        .quote-actions button {
          border-color: #0f766e;
          background: #0f766e;
          color: #ffffff;
        }
        .sheet {
          max-width: 980px;
          margin: 0 auto;
          padding: 44px;
          background: #ffffff;
          border-radius: 24px;
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.12);
        }
        .header {
          display: flex;
          justify-content: space-between;
          gap: 32px;
          padding-bottom: 24px;
          border-bottom: 3px solid #0f766e;
        }
        .brand-mark {
          display: inline-grid;
          width: 48px;
          height: 48px;
          place-items: center;
          border-radius: 14px;
          background: #0f766e;
          color: #ffffff;
          font-size: 22px;
          font-weight: 800;
        }
        h1 {
          margin: 18px 0 6px;
          font-size: 36px;
          letter-spacing: -0.04em;
        }
        h2 {
          margin: 0 0 12px;
          color: #0f766e;
          font-size: 18px;
        }
        .muted {
          color: #64748b;
        }
        .quote-meta {
          min-width: 260px;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          overflow: hidden;
        }
        .meta-row {
          display: grid;
          grid-template-columns: 96px 1fr;
          border-bottom: 1px solid #e2e8f0;
        }
        .meta-row:last-child {
          border-bottom: 0;
        }
        .meta-row span {
          padding: 10px 12px;
        }
        .meta-row span:first-child {
          background: #f8fafc;
          color: #64748b;
          font-weight: 700;
        }
        .two-col {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          margin-top: 26px;
        }
        .panel {
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 18px;
          background: #fbfdff;
        }
        .panel p {
          margin: 4px 0;
        }
        table {
          width: 100%;
          margin-top: 26px;
          border-collapse: collapse;
          overflow: hidden;
          border-radius: 16px;
        }
        th {
          background: #0f766e;
          color: #ffffff;
          text-align: left;
          font-size: 13px;
          letter-spacing: 0.02em;
        }
        th, td {
          padding: 12px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: top;
        }
        td.number, th.number {
          text-align: right;
          white-space: nowrap;
        }
        tbody tr:nth-child(even) {
          background: #f8fafc;
        }
        .summary {
          width: min(420px, 100%);
          margin: 24px 0 0 auto;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          overflow: hidden;
        }
        .summary-row {
          display: grid;
          grid-template-columns: 1fr 150px;
          border-bottom: 1px solid #e2e8f0;
        }
        .summary-row:last-child {
          border-bottom: 0;
          background: #ecfdf5;
          color: #0f766e;
          font-size: 18px;
          font-weight: 800;
        }
        .summary-row span {
          padding: 11px 14px;
        }
        .summary-row span:last-child {
          text-align: right;
        }
        .terms {
          margin-top: 28px;
          padding: 18px;
          border-radius: 18px;
          background: #fff7ed;
          color: #7c2d12;
        }
        .signature {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 28px;
          margin-top: 34px;
        }
        .sign-line {
          padding-top: 46px;
          border-bottom: 1px solid #94a3b8;
          color: #64748b;
        }
        @media print {
          body {
            background: #ffffff;
          }
          .quote-print-page {
            padding: 0;
          }
          .quote-actions {
            display: none;
          }
          .sheet {
            max-width: none;
            box-shadow: none;
            border-radius: 0;
            padding: 22mm;
          }
        }
      `}</style>

      <QuotePrintActions quoteId={quote.id} />

      <section className="sheet">
        <div className="header">
          <div>
            <div className="brand-mark">R</div>
            <h1>正式报价单</h1>
            <p className="muted">Quotation / Proforma Offer</p>
          </div>
          <div className="quote-meta">
            <div className="meta-row"><span>报价单号</span><span>{quote.quoteNo}</span></div>
            <div className="meta-row"><span>报价日期</span><span>{dateText(quote.createdAt)}</span></div>
            <div className="meta-row"><span>有效期至</span><span>{dateText(validUntil)}</span></div>
            <div className="meta-row"><span>状态</span><span>{statusLabels[quote.status] ?? quote.status}</span></div>
          </div>
        </div>

        <div className="two-col">
          <div className="panel">
            <h2>报价方</h2>
            <p><strong>{sellerName}</strong></p>
            {sellerSite ? <p>网站：{sellerSite}</p> : null}
            <p>品牌：{quote.brand?.name ?? "-"}</p>
            <p>平台/店铺：{quote.platform?.name ?? "-"} / {quote.store?.name ?? "-"}</p>
          </div>
          <div className="panel">
            <h2>客户信息</h2>
            <p><strong>{customerName}</strong></p>
            <p>联系人：{quote.customer?.name ?? "-"}</p>
            <p>邮箱：{quote.customer?.email ?? "-"}</p>
            <p>电话/WhatsApp：{quote.customer?.phone || quote.customer?.whatsapp || "-"}</p>
            <p>国家/地区：{quote.customer?.countryCode ?? quote.countryCode ?? "-"}</p>
          </div>
        </div>

        <div className="two-col">
          <div className="panel">
            <h2>询盘信息</h2>
            <p>询盘号：{quote.inquiry?.inquiryNo ?? "-"}</p>
            <p>标题：{quote.inquiry?.title ?? "-"}</p>
          </div>
          <div className="panel">
            <h2>业务来源</h2>
            <p>渠道：{quote.channel ? `${quote.channel.businessLine} / ${quote.channel.channelName}` : "-"}</p>
            <p>报价币种：{quote.currency}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: 48 }}>#</th>
              <th>SKU</th>
              <th>产品名称</th>
              <th className="number">数量</th>
              <th className="number">单价</th>
              <th className="number">小计</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.length ? quote.items.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>{item.sku || "-"}</td>
                <td>{item.productName}</td>
                <td className="number">{item.quantity}</td>
                <td className="number">{moneyText(item.unitPrice, quote.currency)}</td>
                <td className="number">{moneyText(item.totalPrice, quote.currency)}</td>
                <td>{item.remark || "-"}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} className="muted">暂无商品明细，请先在报价中补充商品。</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="summary">
          <div className="summary-row"><span>商品金额</span><span>{moneyText(quote.productAmount, quote.currency)}</span></div>
          <div className="summary-row"><span>运费</span><span>{moneyText(quote.shippingFee, quote.currency)}</span></div>
          <div className="summary-row"><span>税费</span><span>{moneyText(quote.taxAmount, quote.currency)}</span></div>
          <div className="summary-row"><span>其他费用</span><span>{moneyText(quote.otherFee, quote.currency)}</span></div>
          <div className="summary-row"><span>折扣</span><span>- {moneyText(quote.discountAmount, quote.currency)}</span></div>
          <div className="summary-row"><span>报价总额</span><span>{moneyText(quote.totalAmount, quote.currency)}</span></div>
        </div>

        <div className="terms">
          <strong>报价说明：</strong>
          <p>{quote.remark || "本报价以双方最终确认的产品、数量、交期、物流方式和付款条件为准。如需调整数量或运输方式，请联系业务人员重新确认报价。"}</p>
        </div>

        <div className="signature">
          <div className="sign-line">报价方确认</div>
          <div className="sign-line">客户确认</div>
        </div>
      </section>
    </main>
  );
}
