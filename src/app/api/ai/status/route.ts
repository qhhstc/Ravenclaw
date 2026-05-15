import { NextResponse } from "next/server";
import { getAiStatus } from "@/lib/ai/anthropic-client";
import { requireApiSession } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET() {
  await requireApiSession();
  return NextResponse.json(getAiStatus());
}
