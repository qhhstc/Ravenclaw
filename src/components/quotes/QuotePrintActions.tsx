"use client";

import Link from "next/link";

export default function QuotePrintActions({ quoteId }: { quoteId: number }) {
  return (
    <div className="quote-actions">
      <button type="button" onClick={() => window.print()}>
        打印 / 保存 PDF
      </button>
      <Link href="/inquiries">返回报价列表</Link>
      <Link href={`/quote-print/${quoteId}`}>刷新报价单</Link>
    </div>
  );
}
