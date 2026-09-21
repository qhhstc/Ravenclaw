import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { createEntryFxQuoteService, parseEntryFxQuote, validFxDate } from "../src/lib/channel-entry-fx-quotes";
import { revalueEntryMetric, validateEntryFxRate } from "../src/lib/channel-entry-fx";

const now = Date.parse("2026-09-21T10:00:00Z");
const body = { date: "2026-09-18", base: "USD", quote: "CNY", rate: 6.6976 };

test("quote validates currency direction, source date and positive rate", () => {
  assert.deepEqual(parseEntryFxQuote(body, "USD", "2026-09-21"), { rate: 6.6976, rateDate: "2026-09-18" });
  for (const invalid of [{ ...body, base: "CNY" }, { ...body, quote: "USD" }, { ...body, rate: 0 }, { ...body, rate: Infinity }, { ...body, date: "2026-09-22" }, { ...body, date: "2026-02-31" }]) assert.throws(() => parseEntryFxQuote(invalid, "USD", "2026-09-21"));
  assert.equal(validFxDate("2026-02-31"), false);
});

test("quote cache deduplicates requests, polls hourly and retains actual publication date", async () => {
  let time = now, calls = 0;
  const service = createEntryFxQuoteService(async () => { calls++; return Response.json(body); }, () => time);
  const [first, second] = await Promise.all([service("USD"), service("USD")]);
  assert.equal(calls, 1);
  assert.deepEqual(first, second);
  assert.equal(first.rateDate, "2026-09-18");
  assert.equal(first.stale, false);
  await service("USD", { force: true });
  assert.equal(calls, 1, "rapid clicks do not hammer the provider");
  time += 61000;
  await service("USD", { force: true });
  assert.equal(calls, 2);
  time += 3600001;
  await service("USD");
  assert.equal(calls, 3);
});

test("failed refresh exposes stale cached quote instead of labeling it current", async () => {
  let time = now, fail = false;
  const service = createEntryFxQuoteService(async () => { if (fail) throw new Error("offline"); return Response.json(body); }, () => time);
  await service("USD");
  fail = true; time += 3600001;
  const stale = await service("USD");
  assert.equal(stale.rate, 6.6976);
  assert.equal(stale.rateDate, "2026-09-18");
  assert.equal(stale.stale, true);
  assert.ok(stale.error);
  fail = false; time += 61000;
  assert.equal((await service("USD")).stale, false);
});

test("failed first quote retries later and historical requests use the selected date", async () => {
  let time = now, calls = 0;
  const service = createEntryFxQuoteService((async (url) => {
    calls++;
    if (calls === 1) throw new Error("offline");
    assert.ok(String(url).includes("date=2026-08-31"));
    return Response.json({ ...body, date: "2026-08-31" });
  }) as typeof fetch, () => time);
  assert.equal((await service("USD", { asOf: "2026-08-31" })).rate, null);
  time += 61000;
  assert.equal((await service("USD", { asOf: "2026-08-31" })).rateDate, "2026-08-31");
  assert.equal(calls, 2);
});

test("outdated source is marked stale; CNY does not make an external request", async () => {
  let calls = 0;
  const service = createEntryFxQuoteService(async () => { calls++; return Response.json({ ...body, date: "2026-05-01" }); }, () => now);
  assert.equal((await service("USD")).stale, true);
  assert.equal((await service("CNY")).rate, 1);
  assert.equal(calls, 1);
  await assert.rejects(service("USD/../"));
});

test("decimal FX conversion rounds half cents consistently and does not change originals", () => {
  const metric = { salesAmountOriginal: new Prisma.Decimal("0.3"), adSpendOriginal: new Prisma.Decimal("0.1"), refundAmountOriginal: new Prisma.Decimal("-0.3") };
  const snapshot = JSON.stringify(metric);
  const updated = revalueEntryMetric(metric, validateEntryFxRate(6.65));
  assert.equal(updated.salesAmountBase.toString(), "2");
  assert.equal(updated.adSpendBase.toString(), "0.67");
  assert.equal(updated.refundAmountBase.toString(), "-2");
  assert.equal(JSON.stringify(metric), snapshot);
  assert.deepEqual(Object.keys(updated).sort(), ["adSpendBase", "exchangeRate", "refundAmountBase", "salesAmountBase"]);
  for (const invalid of [0, -1, NaN, Infinity, "6.65", 0.00000001]) assert.throws(() => validateEntryFxRate(invalid));
  assert.throws(() => revalueEntryMetric({ ...metric, salesAmountOriginal: new Prisma.Decimal("999999999999") }, validateEntryFxRate(1000000)));
});
