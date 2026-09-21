import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";

async function main() {
  const db = new URL(process.env.DATABASE_URL!);
  assert.ok(["127.0.0.1", "localhost"].includes(db.hostname) && db.pathname === "/cross_border_data_center", "Integration tests must use the local development database");
  const root = "http://localhost:3001";
  const brand = await prisma.brand.findFirst();
  const platform = await prisma.platform.findFirst();
  assert.ok(brand && platform);
  const channel = await prisma.channel.create({ data: { businessLine: `__entry_test_${Date.now()}`, channelName: "自动测试专用渠道", channelGroup: "亚马逊", channelType: "manual", brandId: brand.id, platformId: platform.id } });
  try {
    await prisma.channelMetricPeriod.create({ data: { year: 2026, month: 8, quarter: 3, periodType: "week", weekNumber: 1, channelId: channel.id, brandId: brand.id, platformId: platform.id, currency: "USD", exchangeRate: 6.8, decisionOwner: "原负责人", salesAmountOriginal: 10, salesAmountBase: 68 } });
    const post = () => fetch(`${root}/api/channel-entry/prepare`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year: 2026, month: 9 }) });
    assert.equal((await post()).status, 200);
    assert.equal((await (await post()).json()).createdWeeks, 0);
    await prisma.channelMetricPeriod.updateMany({ where: { channelId: channel.id, year: 2026, month: 9 }, data: { businessBlock: "independent_site" } });
    const read = async () => (await (await fetch(`${root}/api/channel-entry?year=2026&month=9`)).json());
    const before = await read();
    let row = before.rows.find((r: { channelId: number }) => r.channelId === channel.id);
    assert.ok(row);
    assert.equal(row.businessBlock, "amazon", "original channel group must override stale imported block");
    assert.equal(row.currency, "USD"); assert.equal(row.exchangeRate, 6.8); assert.equal(row.owner, "原负责人");
    assert.equal(row.weeks[0].salesAmountOriginal, null);
    const body = { year: 2026, month: 9, actorName: "接口回归测试", owner: "新负责人", remark: "测试备注", version: row.version, weeks: row.weeks.map((w: { weekNumber: number }) => ({ weekNumber: w.weekNumber, salesAmountOriginal: w.weekNumber === 1 ? 0 : null, adSpendOriginal: w.weekNumber === 1 ? 0 : null })) };
    const save = (value: unknown) => fetch(`${root}/api/channel-entry/rows/${channel.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
    const missingActor = await save({ ...body, actorName: "   " });
    assert.equal(missingActor.status, 400, "channel owner does not replace the required actor name");
    assert.equal(await prisma.channelEntryAudit.count({ where: { channelId: channel.id } }), 0);
    const first = await save(body);
    assert.equal(first.status, 200, await first.clone().text());
    row = (await first.json()).row;
    assert.equal(row.weeks[0].salesAmountOriginal, 0); assert.equal(row.weeks[1].salesAmountOriginal, null);
    assert.equal(row.owner, "新负责人"); assert.equal(row.remark, "测试备注");
    assert.equal((await save(body)).status, 409, "stale revision must not overwrite another save");
    const invalid = structuredClone(body); invalid.version = row.version; invalid.weeks[0].adSpendOriginal = -1;
    assert.equal((await save(invalid)).status, 400);
    const update = structuredClone(body); update.version = row.version; update.weeks[0].salesAmountOriginal = 100; update.weeks[0].adSpendOriginal = 10;
    const second = await save(update); assert.equal(second.status, 200, await second.clone().text());
    row = (await second.json()).row;
    assert.equal(row.weeks[0].salesAmountBase, 680); assert.equal(row.weeks[0].adSpendBase, 68);
    const audits = await (await fetch(`${root}/api/channel-entry/audits?year=2026&month=9`)).json();
    assert.equal(audits.audits.filter((a: { channel: { businessLine: string } }) => a.channel.businessLine === channel.businessLine).length, 2);
    assert.ok(!JSON.stringify(audits).includes("ipAddress"));
    assert.equal((await fetch(`${root}/api/channel-entry?year=2026&month=13`)).status, 400);
    assert.equal((await fetch(`${root}/api/channel-data?year=2026&month=9`)).status, 401);
    assert.equal((await fetch(`${root}/channel-entry?year=2027&month=1`, { redirect: "manual" })).status, 200);
    const historyBefore = (await (await fetch(`${root}/api/channel-entry?year=2026&month=8`)).json()).rows.find((r: { channelId: number }) => r.channelId === channel.id);
    // Remove only an empty test-fixture week to prove prepare will not recreate it after the cutoff.
    await prisma.channelMetricPeriod.deleteMany({ where: { channelId: channel.id, year: 2026, month: 9, weekNumber: 5 } });
    const rawBefore = JSON.stringify(await prisma.channelMetricPeriod.findMany({ where: { channelId: channel.id }, orderBy: { id: "asc" } }));
    await prisma.channel.update({ where: { id: channel.id }, data: { entryDisabledFromMonth: 202609 } });
    const stopped = await read();
    assert.ok(!stopped.rows.some((r: { channelId: number }) => r.channelId === channel.id));
    assert.deepEqual(stopped.previousRows.find((r: { channelId: number }) => r.channelId === channel.id), historyBefore, "earlier history remains available for last-month comparisons");
    assert.deepEqual(stopped.rows, before.rows.filter((r: { channelId: number }) => r.channelId !== channel.id), "other channels must remain untouched");
    for (const [year, month] of [[2026, 10], [2027, 1]]) {
      const future = await (await fetch(`${root}/api/channel-entry?year=${year}&month=${month}`)).json();
      assert.ok(!future.rows.some((r: { channelId: number }) => r.channelId === channel.id), "cutoff applies to all future months");
    }
    assert.equal((await (await post()).json()).createdWeeks, 0);
    assert.equal(await prisma.channelMetricPeriod.count({ where: { channelId: channel.id, year: 2026, month: 9 } }), 4, "prepare must not regenerate retired rows");
    assert.equal((await save(update)).status, 404, "a stale browser cannot save into a stopped month");
    assert.equal(JSON.stringify(await prisma.channelMetricPeriod.findMany({ where: { channelId: channel.id }, orderBy: { id: "asc" } })), rawBefore, "cutoff must not modify or delete stored amounts");
    assert.equal(await prisma.channelEntryAudit.count({ where: { channelId: channel.id } }), 2, "prior audit history remains intact");
    await prisma.channel.update({ where: { id: channel.id }, data: { entryDisabledFromMonth: null } });
    assert.equal((await (await post()).json()).createdWeeks, 1, "clearing the cutoff restores future preparation");
    const restored = (await read()).rows.find((r: { channelId: number }) => r.channelId === channel.id);
    assert.equal(restored.weeks[0].salesAmountBase, 680);
    assert.equal(restored.weeks[0].adSpendBase, 68);
    await prisma.channel.update({ where: { id: channel.id }, data: { entryDisabledFromMonth: 202701 } });
    const december = await (await fetch(`${root}/api/channel-entry?year=2026&month=12`)).json();
    const january = await (await fetch(`${root}/api/channel-entry?year=2027&month=1`)).json();
    assert.ok(december.rows.some((r: { channelId: number }) => r.channelId === channel.id));
    assert.ok(!january.rows.some((r: { channelId: number }) => r.channelId === channel.id));
    console.log("PASS: entry save/audit regression; month cutoff, future exclusion, no regeneration, stopped saves rejected, history/other channels preserved, reversible restore, year boundary");
  } finally {
    await prisma.channelMetricPeriod.deleteMany({ where: { channelId: channel.id } });
    await prisma.channel.delete({ where: { id: channel.id } });
    await prisma.$disconnect();
  }
}
void main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exitCode = 1; });
