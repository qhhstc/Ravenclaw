import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/crm";
import { canViewCrm, forbidden, requireApiSession } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await requireApiSession();
    if (!canViewCrm(session.role)) return forbidden("当前角色不能查看业务员列表");
    const items = await prisma.user.findMany({
      where: { status: "active" },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { id: "asc" },
    });
    return NextResponse.json({ items });
  } catch (error) {
    return apiError(error, "用户加载失败");
  }
}
