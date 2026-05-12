import { NextResponse } from "next/server";
import { ApiAuthError, requireApiSession } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await requireApiSession();
    return NextResponse.json({ user: session });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "当前登录状态不可用" }, { status: 401 });
  }
}
