import "dotenv/config";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { currentEntryPeriod, changesBetween } from "../src/lib/public-channel-entry";
import type { EntryData } from "../src/lib/channel-entry-types";

async function main() {
  const db = new URL(process.env.DATABASE_URL!);
  assert.ok(["localhost", "127.0.0.1"].includes(db.hostname) && db.pathname === "/cross_border_data_center", "FX tests must use the local development database");
  assert.equal(await prisma.channelMetricPeriod.count({ where: { currency: "XTS" } }), 0, "Test currency must be unused");
  const root = "http://localhost:3001";
  const period = currentEntryPeriod();
  const prior = period.month === 1 ? { year: period.year - 1, month: 12 } : { year: period.year, month: period.month - 1 };
  const future = period.month === 12 ? { year: period.year + 1, month: 1 } : { year: period.year, month: period.month + 1 };
  const brand = await prisma.brand.findFirstOrThrow();
  const platform = await prisma.platform.findFirstOrThrow();
  const ids: number[] = [];
  const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  try {
    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < 3; index++) {
        const channel = await tx.channel.create({ data: { businessLine: `__fx_test_${Date.now()}_${index}`, channelName: "汇率回归测试专用", channelGroup: "TikTok", channelType: "manual", brandId: brand.id, platformId: platform.id, entryDisabledFromMonth: index === 2 ? period.year * 100 + period.month : null } });
        ids.push(channel.id);
        const common = { channelId: channel.id, brandId: brand.id, platformId: platform.id, periodType: "week", currency: "XTS", decisionOwner: "原负责人", remark: "原备注" };
        for (const weekNumber of [1, 2, 3, 4, 5]) {
          const sales = weekNumber === 1 ? 100 : weekNumber === 2 ? -0.3 : 0;
          const ad = weekNumber === 1 ? 10 : weekNumber === 2 ? 0.1 : 0;
          await tx.channelMetricPeriod.create({ data: { ...common, ...period, quarter: Math.ceil(period.month / 3), weekNumber, exchangeRate: 6.8, salesAmountOriginal: sales, adSpendOriginal: ad, refundAmountOriginal: weekNumber === 1 ? 2 : 0, salesAmountBase: sales * 6.8, adSpendBase: ad * 6.8, refundAmountBase: weekNumber === 1 ? 13.6 : 0, entrySalesEntered: weekNumber < 3, entryAdSpendEntered: weekNumber < 3, productCostBase: 123, otherCostBase: 45, nextBudgetBase: 67 } });
        }
        for (const when of [prior, future]) await tx.channelMetricPeriod.create({ data: { ...common, ...when, quarter: Math.ceil(when.month / 3), weekNumber: 1, exchangeRate: 7, salesAmountOriginal: 100, salesAmountBase: 700 } });
      }
    });
    const activeIds = ids.slice(0, 2);
    const targetWhere = { channelId: { in: activeIds }, ...period, currency: "XTS", periodType: "week" };
    const originals = await prisma.channelMetricPeriod.findMany({ where: targetWhere, orderBy: { id: "asc" } });
    const unrelatedBefore = digest(await prisma.channelMetricPeriod.findMany({ where: { NOT: targetWhere }, orderBy: { id: "asc" } }));
    const read = async (): Promise<EntryData> => (await (await fetch(`${root}/api/channel-entry?year=${period.year}&month=${period.month}`)).json());
    const data = await read();
    const rows = data.rows.filter((row) => row.currency === "XTS");
    assert.deepEqual(rows.map((row) => row.channelId).sort(), activeIds.sort());
    const body = { ...period, currency: "XTS", rate: 6.65, source: "manual", actorName: "汇率回归测试", versions: rows.map(({ channelId, version }) => ({ channelId, version })) };
    const apply = (value: unknown) => fetch(`${root}/api/channel-entry/exchange-rate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
    assert.equal((await apply({ ...body, actorName: " " })).status, 400);
    assert.equal((await apply({ ...body, rate: 0 })).status, 400);
    assert.equal((await apply({ ...body, ...prior })).status, 400);
    assert.equal((await apply({ ...body, ...future })).status, 400);
    assert.equal((await apply({ ...body, versions: body.versions.slice(0, 1) })).status, 409);
    const stale = structuredClone(body); stale.versions[1].version = "stale";
    assert.equal((await apply(stale)).status, 409);
    assert.equal(digest(await prisma.channelMetricPeriod.findMany({ where: targetWhere, orderBy: { id: "asc" } })), digest(originals), "invalid/stale requests change nothing");
    assert.equal(await prisma.channelEntryAudit.count({ where: { channelId: { in: ids } } }), 0);
    const response = await apply(body);
    assert.equal(response.status, 200, await response.clone().text());
    const result = await response.json();
    assert.equal(result.changedChannels, 2);
    const updated = await prisma.channelMetricPeriod.findMany({ where: targetWhere, orderBy: { id: "asc" } });
    const immutable = (item: typeof updated[number]) => Object.fromEntries(Object.entries(item).filter(([key]) => !["exchangeRate", "salesAmountBase", "adSpendBase", "refundAmountBase", "updatedAt"].includes(key)));
    assert.deepEqual(updated.map(immutable), originals.map(immutable), "original amounts, flags, costs, owners, notes and budgets remain untouched");
    for (const item of updated) {
      assert.equal(Number(item.exchangeRate), 6.65);
      if (item.weekNumber === 1) { assert.equal(Number(item.salesAmountBase), 665); assert.equal(Number(item.adSpendBase), 66.5); assert.equal(Number(item.refundAmountBase), 13.3); }
      if (item.weekNumber === 2) { assert.equal(Number(item.salesAmountBase), -2); assert.equal(Number(item.adSpendBase), 0.67); }
    }
    assert.equal(digest(await prisma.channelMetricPeriod.findMany({ where: { NOT: targetWhere }, orderBy: { id: "asc" } })), unrelatedBefore, "history, future, retired channels and other currencies are untouched");
    const logs = await prisma.channelEntryAudit.findMany({ where: { channelId: { in: activeIds }, action: "exchange_rate" } });
    assert.equal(logs.length, 2);
    for (const log of logs) {
      const before = JSON.parse(log.beforeValue!); const after = JSON.parse(log.afterValue!);
      assert.deepEqual(changesBetween(before, after), [{ label: "XTS→CNY 汇率", before: 6.8, after: 6.65 }]);
      assert.equal(before.baseAmounts[0].sales, "680");
      assert.equal(after.baseAmounts[0].sales, "665");
    }
    const old = rows[0];
    const oldSave = await fetch(`${root}/api/channel-entry/rows/${old.channelId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...period, actorName: "旧页面", owner: old.owner, remark: old.remark, version: old.version, weeks: old.weeks }) });
    assert.equal(oldSave.status, 409, "old browser cannot save through a changed rate");
    const fresh = await read();
    const again = await apply({ ...body, versions: fresh.rows.filter((row) => row.currency === "XTS").map(({ channelId, version }) => ({ channelId, version })) });
    assert.equal(again.status, 200);
    assert.equal((await again.json()).changedChannels, 0);
    assert.equal(await prisma.channelEntryAudit.count({ where: { channelId: { in: activeIds }, action: "exchange_rate" } }), 2);
    console.log("PASS: scoped atomic FX repricing, audit, exact decimals, unchanged originals/history/other currencies/retired rows, stale save rejection, no-op idempotency");
  } finally {
    await prisma.channelMetricPeriod.deleteMany({ where: { channelId: { in: ids } } });
    await prisma.channel.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
}
void main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exitCode = 1; });
