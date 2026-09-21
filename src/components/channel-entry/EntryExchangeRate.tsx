"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, App, Button, Input, InputNumber, Modal, Radio, Select, Spin, Tooltip } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import type { EntryData, EntryPeriod } from "@/lib/channel-entry-types";
import type { EntryFxQuote } from "@/lib/channel-entry-fx-types";

export default function EntryExchangeRate({ data, actorName, onActorChange, dirtyCount, busy, onBusyChange, onApplied }: {
  data: EntryData; actorName: string; onActorChange: (name: string) => void; dirtyCount: number; busy: boolean;
  onBusyChange: (busy: boolean) => void; onApplied: (data: EntryData) => void;
}) {
  const { message } = App.useApp();
  const currencies = [...new Set(data.rows.map((row) => row.currency).filter((currency) => currency !== "CNY"))];
  const [selection, setSelection] = useState(currencies[0] ?? "USD");
  const currency = currencies.includes(selection) ? selection : currencies[0] ?? "USD";
  const [quote, setQuote] = useState<EntryFxQuote | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState<EntryPeriod | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"manual" | "reference">("reference");
  const [draftRate, setDraftRate] = useState<number | null>(null);
  const [draftDate, setDraftDate] = useState<string | null>(null);
  const [actorTouched, setActorTouched] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [applying, setApplying] = useState(false);
  const applyingRef = useRef(false);
  const rows = data.rows.filter((row) => row.currency === currency);
  const appliedRates = [...new Set(rows.map((row) => row.exchangeRate))];
  const canApply = currentPeriod?.year === data.year && currentPeriod?.month === data.month;
  const usableQuote = quote?.currency === currency && quote.rate !== null && !quote.stale;
  const referenceError = quoteError || (quote?.currency === currency ? quote.error : "");
  const hasCurrencies = currencies.length > 0;

  useEffect(() => {
    if (!hasCurrencies) return;
    const controller = new AbortController();
    let inFlight = false;
    async function load(force = false) {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true; setRefreshing(true); setQuoteError("");
      try {
        const response = await fetch(`/api/channel-entry/exchange-rate?currency=${encodeURIComponent(currency)}${force ? "&refresh=1" : ""}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "参考汇率获取失败");
        if (!controller.signal.aborted) { setQuote(result.quote); setCurrentPeriod(result.currentPeriod); }
      } catch (error) {
        if (!controller.signal.aborted) { setQuote(null); setQuoteError(error instanceof Error ? error.message : "参考汇率获取失败"); }
      } finally { inFlight = false; if (!controller.signal.aborted) setRefreshing(false); }
    }
    void load(refreshKey > 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [currency, refreshKey, hasCurrencies]);

  function beginApply() {
    if (busy || dirtyCount || !canApply) return;
    setMode(usableQuote ? "reference" : "manual");
    setDraftRate(usableQuote ? quote!.rate : appliedRates.length === 1 ? appliedRates[0] : null);
    setDraftDate(usableQuote ? quote!.rateDate : null);
    setActorTouched(false); setApplyError(""); setOpen(true);
  }

  async function apply() {
    if (busy || applyingRef.current || dirtyCount || !canApply) return;
    setActorTouched(true);
    if (!actorName.trim()) { document.getElementById("entry-fx-actor")?.focus(); return; }
    if (draftRate === null || !Number.isFinite(draftRate) || draftRate <= 0) { setApplyError("请输入有效的正数汇率"); return; }
    applyingRef.current = true; setApplying(true); onBusyChange(true); setApplyError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch("/api/channel-entry/exchange-rate", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ year: data.year, month: data.month, currency, rate: draftRate, source: mode, quoteDate: draftDate, actorName: actorName.trim(), versions: rows.map((row) => ({ channelId: row.channelId, version: row.version })) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "汇率更新失败，请刷新核对");
      onApplied(result.data); setOpen(false);
      message.open({ key: "entry-fx-apply", type: "success", content: result.changedChannels ? `已按 ${result.rate} 重算 ${result.changedChannels} 个渠道，原币金额未改动` : "汇率及金额无需调整" });
    } catch (error) {
      setApplyError(controller.signal.aborted ? "请求超时，结果未确认。请刷新核对后再操作。" : error instanceof Error ? error.message : "结果未确认，请刷新核对");
    } finally { window.clearTimeout(timeout); applyingRef.current = false; setApplying(false); onBusyChange(false); }
  }

  if (!hasCurrencies) return null;
  return <>
    <div className="entry-fx-bar">
      <div className="entry-fx-applied">
        {currencies.length > 1 ? <Select aria-label="汇率币种" value={currency} onChange={setSelection} disabled={busy} options={currencies.map((value) => ({ value, label: `${value} → CNY` }))} /> : <b>{currency} → CNY</b>}
        <span>{data.month} 月核算汇率 <b>{appliedRates.length === 1 ? appliedRates[0] : "多个汇率"}</b></span>
      </div>
      <div className="entry-fx-reference">
        {refreshing ? <Spin size="small" /> : null}
        <span>最新参考 <b>{quote?.currency === currency && quote.rate !== null ? quote.rate : "—"}</b></span>
        {quote?.currency === currency && quote.rateDate && <small>数据日 {quote.rateDate} · ECB</small>}
        <Tooltip title={quote ? `检查于 ${new Date(quote.checkedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}。工作日参考价，非秒级行情；页面打开时每小时检查，参考价不会自动改写核算金额。` : "获取最新工作日参考价，不改写已填金额"}><span className="entry-fx-help">ⓘ</span></Tooltip>
        <Button size="small" icon={<ReloadOutlined />} loading={refreshing} disabled={applying} onClick={() => setRefreshKey((key) => key + 1)}>刷新参考</Button>
      </div>
      <Tooltip title={dirtyCount ? `先保存或撤销 ${dirtyCount} 行未提交改动，再调整汇率` : !canApply ? "仅当前月份可调整，历史和未来月份保持原核算汇率" : "确认后重算当前月份，原币和历史月份不变"}>
        <Button disabled={busy || dirtyCount > 0 || !canApply} onClick={beginApply}>应用本月</Button>
      </Tooltip>
      {referenceError && <small className="entry-fx-warning">{referenceError}</small>}
      {dirtyCount > 0 && <small className="entry-fx-warning">有 {dirtyCount} 行未保存，保存后可调整汇率。</small>}
    </div>
    <Modal title={`调整 ${data.year}年${data.month}月 ${currency}→CNY 汇率`} open={open} onCancel={() => { if (!applying) setOpen(false); }} onOk={() => void apply()} okText="确认重算本月" cancelText="取消" confirmLoading={applying} closable={!applying} mask={{ closable: !applying }} keyboard={!applying} cancelButtonProps={{ disabled: applying }} okButtonProps={{ disabled: dirtyCount > 0 || !canApply }}>
      <div className="entry-fx-form">
        <p>将调整本月全部 {rows.length} 个 {currency} 渠道的 W1–W5，重算人民币销售额、广告费和退款。原币金额、其他币种及以前月份不变。</p>
        <Radio.Group aria-label="汇率来源" disabled={applying} value={mode} onChange={(event) => { const value = event.target.value as "manual" | "reference"; setMode(value); setApplyError(""); setDraftRate(value === "reference" ? quote?.rate ?? null : appliedRates.length === 1 ? appliedRates[0] : null); setDraftDate(value === "reference" ? quote?.rateDate ?? null : null); }} options={[{ value: "reference", label: "最新参考价", disabled: !usableQuote }, { value: "manual", label: "手动指定" }]} />
        <label htmlFor="entry-fx-rate">折算汇率（1 {currency} = ? CNY）</label>
        <InputNumber id="entry-fx-rate" aria-label="本月折算汇率" value={draftRate} onChange={setDraftRate} disabled={applying || mode === "reference"} precision={6} min={0.000001} max={1000000} controls={false} />
        {mode === "reference" && <small>参考数据日：{draftDate}（不是银行实时结算价）</small>}
        <label htmlFor="entry-fx-actor">填写人姓名（必填）</label>
        <Input id="entry-fx-actor" aria-label="汇率调整填写人" value={actorName} onChange={(event) => onActorChange(event.target.value)} maxLength={80} disabled={applying} status={actorTouched && !actorName.trim() ? "error" : undefined} aria-invalid={actorTouched && !actorName.trim()} placeholder="填写你本人的姓名，用于留痕" />
        {actorTouched && !actorName.trim() && <small className="entry-field-error" role="alert">请填写本次调整人的姓名。</small>}
        {applyError && <Alert type="error" showIcon title={applyError} />}
      </div>
    </Modal>
  </>;
}
