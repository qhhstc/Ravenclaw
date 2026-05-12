import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/crm";

export async function GET() {
  try {
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
