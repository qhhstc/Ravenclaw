import type { NextRequest } from "next/server";
import { ApiAuthError, forbidden, requireApiSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parseDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanWarningLevel(value: unknown) {
  const level = cleanText(value).toUpperCase();
  return ["A", "B", "C", "D"].includes(level) ? level : undefined;
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/dashboard/business-warnings/[id]">) {
  try {
    const session = await requireApiSession();
    if (session.role !== "admin") return forbidden("只有管理员可以编辑预警决策");

    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ message: "预警 ID 不正确" }, { status: 400 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const warning = await prisma.businessWarning.update({
      where: { id },
      data: {
        manualActionSuggestion: cleanText(body.manualActionSuggestion) || null,
        decisionOwner: cleanText(body.decisionOwner) || null,
        decisionDeadline: parseDate(body.decisionDeadline),
        remark: cleanText(body.remark) || null,
        ...(cleanWarningLevel(body.warningLevel) ? { warningLevel: cleanWarningLevel(body.warningLevel) } : {}),
      },
    });

    return Response.json({ ok: true, warning });
  } catch (error) {
    if (error instanceof ApiAuthError) return Response.json({ message: error.message }, { status: error.status });
    return Response.json({ message: error instanceof Error ? error.message : "预警决策保存失败" }, { status: 400 });
  }
}
