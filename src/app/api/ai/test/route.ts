import { NextResponse } from "next/server";
import { callClaudeJson } from "@/lib/ai/anthropic-client";
import { canManageAccounts, forbidden, requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await requireApiSession();
    if (!canManageAccounts(session.role)) return forbidden("当前角色不能测试 AI 配置");
    const result = await callClaudeJson<{ ok: boolean }>({
      systemPrompt: "你是 JSON API。只能返回 JSON。",
      userPrompt: "请只返回 JSON: {\"ok\": true}",
      schemaHint: "{\"ok\": true}",
    });
    return NextResponse.json({ ok: result.ok === true, result });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 400;
    return NextResponse.json({ message: error instanceof Error ? error.message : "AI 测试失败" }, { status });
  }
}
